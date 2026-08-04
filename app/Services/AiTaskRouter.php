<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\AiCredential;
use App\Models\AiModel;
use App\Models\AiProvider;
use App\Models\AiTaskRoute;
use App\Models\AiUsageRecord;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AiTaskRouter
{
    /**
     * Record a billable task performed by an adapter that does not expose a
     * chat-completions response (for example the current try-on provider).
     */
    public function recordExternalUsage(string $taskKey, array $options = []): AiUsageRecord
    {
        $startedAt = $options['started_at'] ?? now();

        return AiUsageRecord::create([
            'user_id' => $options['user_id'] ?? Auth::id(),
            'scope_type' => $options['scope_type'] ?? 'user',
            'merchant_id' => $options['merchant_id'] ?? null,
            'actor_user_id' => $options['actor_user_id'] ?? Auth::id(),
            'task_key' => $taskKey,
            'route_version' => $options['route_version'] ?? null,
            'provider_key' => $options['provider_key'] ?? 'external',
            'model_key' => $options['model_key'] ?? null,
            'credential_hint' => $options['credential_hint'] ?? null,
            'provider_request_id' => $options['provider_request_id'] ?? null,
            'status' => $options['status'] ?? 'completed',
            'attempt_number' => $options['attempt_number'] ?? 1,
            'fallback_reason' => $options['fallback_reason'] ?? null,
            'input_units' => $options['input_units'] ?? null,
            'output_units' => $options['output_units'] ?? null,
            'billable_units' => $options['billable_units'] ?? 1,
            'unit_type' => $options['unit_type'] ?? $this->unitType($taskKey),
            'provider_cost' => $options['provider_cost'] ?? 0,
            'input_rate_per_million' => $options['input_rate_per_million'] ?? null,
            'output_rate_per_million' => $options['output_rate_per_million'] ?? null,
            'pricing_source' => $options['pricing_source'] ?? 'external_adapter',
            'provider_cost_currency' => strtoupper((string) ($options['provider_cost_currency'] ?? 'USD')),
            'charged_credits' => $options['charged_credits'] ?? 0,
            'started_at' => $startedAt,
            'completed_at' => $options['completed_at'] ?? now(),
            'latency_ms' => $options['latency_ms'] ?? null,
            'error_code' => $options['error_code'] ?? null,
            'error_message' => isset($options['error_message']) ? mb_substr((string) $options['error_message'], 0, 1000) : null,
            'metadata' => $options['metadata'] ?? [],
        ]);
    }

    /**
     * Send a chat/vision request using the configured model and key route.
     *
     * The database-backed route is preferred. Environment and legacy admin
     * settings remain a safe compatibility fallback while installations move
     * to the new AI control plane.
     */
    public function chatForTask(
        array $messages,
        string $taskKey,
        ?string $requestedModel = null,
        array $options = []
    ): array {
        $route = AiTaskRoute::query()
            ->with(['primaryModel.provider'])
            ->where('task_key', $taskKey)
            ->first();

        if ($route && ! $route->is_active) {
            throw new \RuntimeException("AI task '{$taskKey}' is disabled.");
        }

        $models = $this->candidateModels($route, $requestedModel);
        $requiredCapability = $options['required_capability'] ?? $route?->required_capability;
        $lastException = null;
        $attemptNumber = 0;
        $requestStartedAt = microtime(true);

        foreach ($models as $model) {
            if (! $model->is_active || ! $model->supports($requiredCapability)) {
                continue;
            }

            $provider = $model->provider;
            if (! $provider || ! $provider->is_active) {
                continue;
            }

            $credentials = $this->availableCredentials($provider);
            foreach ($credentials as $credential) {
                $attemptNumber++;
                $attemptOptions = array_merge($options, [
                    'attempt_number' => $attemptNumber,
                    'fallback_reason' => $attemptNumber > 1 ? 'previous_route_attempt_failed' : null,
                    'request_started_at' => $requestStartedAt,
                ]);
                try {
                    $response = $this->send($provider, $credential, $model->model_key, $messages, $attemptOptions);
                    $this->markCredentialUsed($credential);
                    $this->recordUsage($taskKey, $provider, $credential, $model, $response, $route, $attemptOptions);

                    return $response;
                } catch (Throwable $exception) {
                    $lastException = $exception;
                    $this->recordFailure($taskKey, $provider, $credential, $model, $route, $attemptOptions, $exception);
                    $this->markCredentialFailed($credential, $exception);
                }
            }

            // Keep the existing env/legacy setting working until all keys are
            // moved into the encrypted credential table.
            $legacyKey = $this->legacyKey($provider);
            if ($legacyKey !== '') {
                $attemptNumber++;
                $attemptOptions = array_merge($options, [
                    'attempt_number' => $attemptNumber,
                    'fallback_reason' => $attemptNumber > 1 ? 'previous_route_attempt_failed' : null,
                    'request_started_at' => $requestStartedAt,
                ]);
                try {
                    $response = $this->send($provider, null, $model->model_key, $messages, $attemptOptions, $legacyKey);
                    $this->recordUsage($taskKey, $provider, null, $model, $response, $route, $attemptOptions);

                    return $response;
                } catch (Throwable $exception) {
                    $lastException = $exception;
                    $this->recordFailure($taskKey, $provider, null, $model, $route, $attemptOptions, $exception);
                }
            }
        }

        if ($lastException) {
            throw new \RuntimeException(
                "No configured AI route succeeded for '{$taskKey}': {$lastException->getMessage()}",
                (int) $lastException->getCode(),
                $lastException
            );
        }

        throw new \RuntimeException("No active AI model is configured for '{$taskKey}'.");
    }

    public function chatCompletions(array $messages, ?string $model = null, string $taskKey = 'generic'): array
    {
        return $this->chatForTask($messages, $taskKey, $model);
    }

    /**
     * Stream one OpenAI-compatible chat completion while keeping the same
     * route, credential rotation, and usage audit trail as chatForTask().
     *
     * The callback receives text deltas as soon as the provider sends them.
     * Tool-call deltas are assembled and returned in the normal completion
     * shape so a caller can execute a tool and start the next round.
     */
    public function streamForTask(
        array $messages,
        string $taskKey,
        ?string $requestedModel = null,
        array $options = [],
        ?callable $onDelta = null
    ): array {
        $route = AiTaskRoute::query()
            ->with(['primaryModel.provider'])
            ->where('task_key', $taskKey)
            ->first();

        if ($route && ! $route->is_active) {
            throw new \RuntimeException("AI task '{$taskKey}' is disabled.");
        }

        $models = $this->candidateModels($route, $requestedModel);
        $requiredCapability = $options['required_capability'] ?? $route?->required_capability;
        $lastException = null;
        $attemptNumber = 0;
        $requestStartedAt = microtime(true);

        foreach ($models as $model) {
            if (! $model->is_active || ! $model->supports($requiredCapability)) {
                continue;
            }

            $provider = $model->provider;
            if (! $provider || ! $provider->is_active) {
                continue;
            }

            $credentials = $this->availableCredentials($provider);
            foreach ($credentials as $credential) {
                $attemptNumber++;
                $attemptOptions = array_merge($options, [
                    'attempt_number' => $attemptNumber,
                    'fallback_reason' => $attemptNumber > 1 ? 'previous_route_attempt_failed' : null,
                    'request_started_at' => $requestStartedAt,
                ]);

                try {
                    $response = $this->sendStream($provider, $credential, $model->model_key, $messages, $attemptOptions, $onDelta);
                    $this->markCredentialUsed($credential);
                    $this->recordUsage($taskKey, $provider, $credential, $model, $response, $route, $attemptOptions);

                    return $response;
                } catch (Throwable $exception) {
                    $lastException = $exception;
                    $this->recordFailure($taskKey, $provider, $credential, $model, $route, $attemptOptions, $exception);
                    $this->markCredentialFailed($credential, $exception);
                }
            }

            $legacyKey = $this->legacyKey($provider);
            if ($legacyKey !== '') {
                $attemptNumber++;
                $attemptOptions = array_merge($options, [
                    'attempt_number' => $attemptNumber,
                    'fallback_reason' => $attemptNumber > 1 ? 'previous_route_attempt_failed' : null,
                    'request_started_at' => $requestStartedAt,
                ]);

                try {
                    $response = $this->sendStream($provider, null, $model->model_key, $messages, $attemptOptions, $onDelta, $legacyKey);
                    $this->recordUsage($taskKey, $provider, null, $model, $response, $route, $attemptOptions);

                    return $response;
                } catch (Throwable $exception) {
                    $lastException = $exception;
                    $this->recordFailure($taskKey, $provider, null, $model, $route, $attemptOptions, $exception);
                }
            }
        }

        if ($lastException) {
            throw new \RuntimeException(
                "No configured AI route succeeded for '{$taskKey}': {$lastException->getMessage()}",
                (int) $lastException->getCode(),
                $lastException
            );
        }

        throw new \RuntimeException("No active AI model is configured for '{$taskKey}'.");
    }

    /**
     * @return array<int, AiModel>
     */
    private function candidateModels(?AiTaskRoute $route, ?string $requestedModel): array
    {
        if ($requestedModel) {
            $model = AiModel::query()
                ->with('provider')
                ->where('model_key', $requestedModel)
                ->where('is_active', true)
                ->first();

            if ($model) {
                return [$model];
            }

            $provider = AiProvider::query()->where('key', 'openrouter')->first();
            if ($provider) {
                $model = new AiModel([
                    'ai_provider_id' => $provider->id,
                    'model_key' => $requestedModel,
                    'label' => $requestedModel,
                    'capabilities' => ['*'],
                    'is_active' => true,
                ]);
                $model->setRelation('provider', $provider);

                return [$model];
            }
        }

        if (! $route) {
            $fallback = (string) config('services.openrouter.ocr_model', 'google/gemini-2.5-flash');
            $provider = AiProvider::query()->where('key', 'openrouter')->first();
            if ($provider) {
                $model = new AiModel([
                    'ai_provider_id' => $provider->id,
                    'model_key' => $fallback,
                    'label' => $fallback,
                    'capabilities' => ['*'],
                    'is_active' => true,
                ]);
                $model->setRelation('provider', $provider);

                return [$model];
            }

            return [];
        }

        $models = collect();
        if ($route->primaryModel) {
            $models->push($route->primaryModel);
        }

        $fallbackIds = collect($route->fallback_model_ids ?: [])
            ->filter(fn ($id) => is_numeric($id))
            ->map(fn ($id) => (int) $id)
            ->values();

        if ($fallbackIds->isNotEmpty()) {
            $fallbacks = AiModel::query()
                ->with('provider')
                ->whereIn('id', $fallbackIds)
                ->where('is_active', true)
                ->get()
                ->sortBy(fn (AiModel $model) => $fallbackIds->search($model->id));
            $models = $models->concat($fallbacks);
        }

        return $models->unique('id')->values()->all();
    }

    /**
     * @return array<int, AiCredential>
     */
    private function availableCredentials(AiProvider $provider): array
    {
        return $provider->credentials()
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('disabled_until')->orWhere('disabled_until', '<=', now());
            })
            ->get()
            ->sortBy(function (AiCredential $credential): string {
                $weight = max(1, (int) $credential->weight);
                $failureScore = ((int) $credential->failure_count + 1) / $weight;
                $lastUsed = $credential->last_used_at?->getTimestamp() ?? 0;

                return sprintf('%05d:%012.6f:%012d', (int) $credential->priority, $failureScore, $lastUsed);
            })
            ->values()
            ->all();
    }

    private function send(
        AiProvider $provider,
        ?AiCredential $credential,
        string $model,
        array $messages,
        array $options = [],
        ?string $overrideKey = null
    ): array {
        $apiKey = $overrideKey ?: (string) $credential?->secret;
        if ($apiKey === '') {
            throw new \RuntimeException("No API key is configured for {$provider->name}.");
        }

        $baseUrl = rtrim((string) ($provider->base_url ?: config('services.openrouter.base_url')), '/');
        $payload = array_merge([
            'model' => $model,
            'messages' => $messages,
        ], $options['payload'] ?? []);

        $response = Http::timeout((int) ($options['timeout'] ?? config('services.openrouter.timeout', 45)))
            ->acceptJson()
            ->withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'HTTP-Referer' => config('app.url'),
                'X-Title' => 'Takeer Social Commerce',
            ])
            ->post($baseUrl.'/chat/completions', $payload);

        if ($response->failed()) {
            throw new \RuntimeException(
                'AI provider returned HTTP '.$response->status().': '.Str::limit($response->body(), 300)
            );
        }

        $json = $response->json();
        $message = data_get($json, 'choices.0.message');
        if (! is_array($json) || ! is_array($message) || (
            blank($message['content'] ?? null)
            && empty($message['tool_calls'] ?? null)
        )) {
            throw new \RuntimeException("AI provider returned an empty response for model {$model}.");
        }

        return $json;
    }

    private function sendStream(
        AiProvider $provider,
        ?AiCredential $credential,
        string $model,
        array $messages,
        array $options = [],
        ?callable $onDelta = null,
        ?string $overrideKey = null
    ): array {
        $apiKey = $overrideKey ?: (string) $credential?->secret;
        if ($apiKey === '') {
            throw new \RuntimeException("No API key is configured for {$provider->name}.");
        }

        $baseUrl = rtrim((string) ($provider->base_url ?: config('services.openrouter.base_url')), '/');
        $payload = array_merge([
            'model' => $model,
            'messages' => $messages,
            'stream' => true,
            'stream_options' => ['include_usage' => true],
        ], $options['payload'] ?? [], ['stream' => true]);

        $response = Http::timeout((int) ($options['timeout'] ?? config('services.openrouter.timeout', 45)))
            ->withOptions(['stream' => true])
            ->acceptJson()
            ->withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'HTTP-Referer' => config('app.url'),
                'X-Title' => 'Takeer Social Commerce',
            ])
            ->post($baseUrl.'/chat/completions', $payload);

        if ($response->failed()) {
            throw new \RuntimeException(
                'AI provider returned HTTP '.$response->status().': '.Str::limit($response->body(), 300)
            );
        }

        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $toolCalls = [];
        $usage = [];
        $responseId = null;
        $finishReason = null;

        $processFrame = function (string $frame) use (&$content, &$toolCalls, &$usage, &$responseId, &$finishReason, $onDelta): void {
            $data = [];
            foreach (preg_split('/\n/', str_replace("\r", '', $frame)) ?: [] as $line) {
                if (Str::startsWith($line, 'data:')) {
                    $data[] = ltrim(substr($line, 5));
                }
            }

            $jsonLine = trim(implode("\n", $data));
            if ($jsonLine === '' || $jsonLine === '[DONE]') {
                return;
            }

            $chunk = json_decode($jsonLine, true);
            if (! is_array($chunk)) {
                return;
            }

            $responseId ??= $chunk['id'] ?? null;
            if (isset($chunk['usage']) && is_array($chunk['usage'])) {
                $usage = $chunk['usage'];
            }

            $choice = $chunk['choices'][0] ?? [];
            $delta = $choice['delta'] ?? [];
            $deltaContent = $delta['content'] ?? null;
            if (is_string($deltaContent) && $deltaContent !== '') {
                $content .= $deltaContent;
                if ($onDelta) {
                    $onDelta($deltaContent);
                }
            }

            foreach (($delta['tool_calls'] ?? []) as $toolCall) {
                $index = (int) ($toolCall['index'] ?? 0);
                $toolCalls[$index] ??= [
                    'id' => null,
                    'type' => 'function',
                    'function' => ['name' => '', 'arguments' => ''],
                ];
                if (isset($toolCall['id'])) {
                    $toolCalls[$index]['id'] = $toolCall['id'];
                }
                if (isset($toolCall['type'])) {
                    $toolCalls[$index]['type'] = $toolCall['type'];
                }
                if (isset($toolCall['function']['name'])) {
                    $toolCalls[$index]['function']['name'] .= $toolCall['function']['name'];
                }
                if (isset($toolCall['function']['arguments'])) {
                    $toolCalls[$index]['function']['arguments'] .= $toolCall['function']['arguments'];
                }
            }

            if (array_key_exists('finish_reason', $choice) && $choice['finish_reason'] !== null) {
                $finishReason = $choice['finish_reason'];
            }
        };

        while (! $body->eof()) {
            $chunk = $body->read(8192);
            if ($chunk === '') {
                break;
            }
            $buffer .= str_replace(["\r\n", "\r"], "\n", $chunk);

            while (($separator = strpos($buffer, "\n\n")) !== false) {
                $frame = substr($buffer, 0, $separator);
                $buffer = substr($buffer, $separator + 2);
                $processFrame($frame);
            }
        }

        if (trim($buffer) !== '') {
            $processFrame($buffer);
        }

        $normalizedToolCalls = array_values($toolCalls);
        if ($content === '' && $normalizedToolCalls === []) {
            throw new \RuntimeException("AI provider returned an empty streamed response for model {$model}.");
        }

        return [
            'id' => $responseId,
            'choices' => [[
                'message' => array_filter([
                    'role' => 'assistant',
                    'content' => $content !== '' ? $content : null,
                    'tool_calls' => $normalizedToolCalls !== [] ? $normalizedToolCalls : null,
                ], fn ($value) => $value !== null),
                'finish_reason' => $finishReason,
            ]],
            'usage' => $usage,
        ];
    }

    private function legacyKey(AiProvider $provider): string
    {
        if ($provider->key !== 'openrouter') {
            return '';
        }

        return trim((string) (AdminSetting::get('openrouter_api_key') ?: config('services.openrouter.api_key')));
    }

    private function markCredentialUsed(AiCredential $credential): void
    {
        $credential->forceFill([
            'last_used_at' => now(),
            'failure_count' => 0,
            'disabled_until' => null,
        ])->save();
    }

    private function markCredentialFailed(AiCredential $credential, Throwable $exception): void
    {
        $failures = (int) $credential->failure_count + 1;
        $credential->forceFill([
            'failure_count' => $failures,
            'last_failed_at' => now(),
            'disabled_until' => $failures >= 3 ? now()->addMinutes(5) : null,
        ])->save();

        Log::warning('AI credential failed', [
            'credential_id' => $credential->id,
            'provider' => $credential->provider?->key,
            'failure_count' => $failures,
            'error' => Str::limit($exception->getMessage(), 200),
        ]);
    }

    private function recordUsage(
        string $taskKey,
        AiProvider $provider,
        ?AiCredential $credential,
        AiModel $model,
        array $response,
        ?AiTaskRoute $route,
        array $options
    ): void {
        $usage = (array) ($response['usage'] ?? []);
        $inputUnits = $usage['prompt_tokens'] ?? $usage['input_tokens'] ?? null;
        $outputUnits = $usage['completion_tokens'] ?? $usage['output_tokens'] ?? null;
        $reportedCost = data_get($usage, 'cost', data_get($response, 'cost'));
        $providerCost = is_numeric($reportedCost) ? (float) $reportedCost : null;
        $pricingSource = $providerCost !== null ? 'provider_reported' : 'configured_model_rates';
        if ($inputUnits !== null || $outputUnits !== null) {
            $providerCost ??= ((float) ($inputUnits ?: 0) / 1_000_000) * (float) ($model->input_cost_per_million ?: 0)
                + ((float) ($outputUnits ?: 0) / 1_000_000) * (float) ($model->output_cost_per_million ?: 0);
        }

        AiUsageRecord::create([
            'user_id' => $options['user_id'] ?? Auth::id(),
            'scope_type' => $options['scope_type'] ?? 'user',
            'merchant_id' => $options['merchant_id'] ?? null,
            'actor_user_id' => $options['actor_user_id'] ?? Auth::id(),
            'task_key' => $taskKey,
            'route_version' => $route?->updated_at?->toISOString() ?: ($route?->id ? 'route-'.$route->id : null),
            'ai_provider_id' => $provider->id,
            'provider_key' => $provider->key,
            'ai_credential_id' => $credential?->id,
            'ai_model_id' => $model->exists ? $model->id : null,
            'model_key' => $model->model_key,
            'credential_hint' => $credential?->key_hint,
            'provider_request_id' => $response['id'] ?? null,
            'status' => 'completed',
            'attempt_number' => $options['attempt_number'] ?? 1,
            'fallback_reason' => $options['fallback_reason'] ?? null,
            'input_units' => $inputUnits,
            'output_units' => $outputUnits,
            'billable_units' => $options['billable_units'] ?? 1,
            'unit_type' => $options['unit_type'] ?? $this->unitType($taskKey),
            'provider_cost' => $providerCost,
            'input_rate_per_million' => $model->input_cost_per_million,
            'output_rate_per_million' => $model->output_cost_per_million,
            'pricing_source' => $pricingSource,
            'provider_cost_currency' => strtoupper((string) (data_get($usage, 'cost_currency') ?: data_get($provider->config ?: [], 'currency', 'USD'))),
            'charged_credits' => $options['charged_credits'] ?? 0,
            'started_at' => $options['started_at'] ?? now(),
            'completed_at' => now(),
            'latency_ms' => $this->latencyMs($options),
            'metadata' => array_merge([
                'route_id' => $route?->id,
                'configured_credit_cost' => $route?->credit_cost,
                'requested_model' => $options['requested_model'] ?? null,
                'response_usage' => array_filter([
                    'prompt_tokens' => $inputUnits,
                    'completion_tokens' => $outputUnits,
                    'reported_cost' => $reportedCost,
                ], fn ($value) => $value !== null),
            ], $options['metadata'] ?? []),
        ]);
    }

    private function recordFailure(
        string $taskKey,
        AiProvider $provider,
        ?AiCredential $credential,
        AiModel $model,
        ?AiTaskRoute $route,
        array $options,
        Throwable $exception
    ): void {
        AiUsageRecord::create([
            'user_id' => $options['user_id'] ?? Auth::id(),
            'scope_type' => $options['scope_type'] ?? 'user',
            'merchant_id' => $options['merchant_id'] ?? null,
            'actor_user_id' => $options['actor_user_id'] ?? Auth::id(),
            'task_key' => $taskKey,
            'route_version' => $route?->updated_at?->toISOString() ?: ($route?->id ? 'route-'.$route->id : null),
            'ai_provider_id' => $provider->id,
            'provider_key' => $provider->key,
            'ai_credential_id' => $credential?->id,
            'ai_model_id' => $model->exists ? $model->id : null,
            'model_key' => $model->model_key,
            'credential_hint' => $credential?->key_hint,
            'status' => 'failed',
            'attempt_number' => $options['attempt_number'] ?? 1,
            'fallback_reason' => $options['fallback_reason'] ?? null,
            'billable_units' => 0,
            'unit_type' => $options['unit_type'] ?? $this->unitType($taskKey),
            'input_rate_per_million' => $model->input_cost_per_million,
            'output_rate_per_million' => $model->output_cost_per_million,
            'pricing_source' => 'configured_model_rates',
            'provider_cost_currency' => strtoupper((string) data_get($provider->config ?: [], 'currency', 'USD')),
            'started_at' => $options['started_at'] ?? now(),
            'completed_at' => now(),
            'latency_ms' => $this->latencyMs($options),
            'error_code' => (string) $exception->getCode() ?: 'provider_error',
            'error_message' => mb_substr($exception->getMessage(), 0, 1000),
            'metadata' => array_merge([
                'route_id' => $route?->id,
                'configured_credit_cost' => $route?->credit_cost,
                'requested_model' => $options['requested_model'] ?? null,
            ], $options['metadata'] ?? []),
        ]);
    }

    private function latencyMs(array $options): int
    {
        $started = (float) ($options['request_started_at'] ?? microtime(true));

        return max(0, (int) round((microtime(true) - $started) * 1000));
    }

    private function unitType(string $taskKey): string
    {
        return match ($taskKey) {
            'product_information_extraction', 'waybill_ocr' => 'document',
            'product_photo_editing', 'virtual_try_on' => 'image',
            'ai_search' => 'query',
            default => 'request',
        };
    }
}
