<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiCredential;
use App\Models\AiModel;
use App\Models\AiPlan;
use App\Models\AiProvider;
use App\Models\AiSubscription;
use App\Models\AiTaskRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAiController extends Controller
{
    public function index(): JsonResponse
    {
        $provider = AiProvider::query()
            ->with(['credentials', 'models'])
            ->where('key', 'openrouter')
            ->firstOrFail();

        $routes = AiTaskRoute::query()
            ->with('primaryModel')
            ->orderBy('label')
            ->get();

        return response()->json([
            'provider' => [
                'id' => $provider->id,
                'key' => $provider->key,
                'name' => $provider->name,
                'base_url' => $provider->base_url,
                'is_active' => $provider->is_active,
            ],
            'credentials' => $provider->credentials
                ->sortBy(['priority', 'name'])
                ->values()
                ->map(fn (AiCredential $credential) => [
                    'id' => $credential->id,
                    'name' => $credential->name,
                    'key_hint' => $credential->maskedKey(),
                    'status' => $credential->status,
                    'priority' => (int) $credential->priority,
                    'weight' => (int) $credential->weight,
                    'failure_count' => (int) $credential->failure_count,
                    'last_used_at' => $credential->last_used_at?->toISOString(),
                    'disabled_until' => $credential->disabled_until?->toISOString(),
                ]),
            'models' => $provider->models
                ->sortBy('label')
                ->values()
                ->map(fn (AiModel $model) => [
                    'id' => $model->id,
                    'model_key' => $model->model_key,
                    'label' => $model->label,
                    'capabilities' => $model->capabilities ?: [],
                    'input_cost_per_million' => $model->input_cost_per_million,
                    'output_cost_per_million' => $model->output_cost_per_million,
                    'is_active' => $model->is_active,
                ]),
            'tasks' => $routes->map(fn (AiTaskRoute $route) => [
                'id' => $route->id,
                'task_key' => $route->task_key,
                'label' => $route->label,
                'description' => $route->description,
                'required_capability' => $route->required_capability,
                'primary_model_id' => $route->primary_model_id,
                'fallback_model_ids' => array_values(array_map('intval', $route->fallback_model_ids ?: [])),
                'credit_cost' => $route->credit_cost,
                'is_active' => $route->is_active,
            ]),
            'plans' => AiPlan::query()
                ->with('limits')
                ->orderBy('sort_order')
                ->orderBy('price')
                ->get()
                ->map(fn (AiPlan $plan) => $this->planPayload($plan)),
            'legacy' => [
                'env_key_present' => filled(config('services.openrouter.api_key')),
                'admin_key_present' => filled(\App\Models\AdminSetting::get('openrouter_api_key')),
            ],
        ]);
    }

    public function storeCredential(Request $request): JsonResponse
    {
        $provider = $this->provider();
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'api_key' => ['required', 'string', 'min:12', 'max:500'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:10000'],
            'weight' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $secret = trim($validated['api_key']);
        $credential = $provider->credentials()->create([
            'name' => trim($validated['name']),
            'secret' => $secret,
            'key_hint' => substr($secret, -4),
            'status' => 'active',
            'priority' => (int) ($validated['priority'] ?? 100),
            'weight' => (int) ($validated['weight'] ?? 100),
        ]);

        return response()->json([
            'message' => 'OpenRouter API key added securely.',
            'credential' => $this->credentialPayload($credential),
        ], 201);
    }

    public function updateCredential(Request $request, AiCredential $credential): JsonResponse
    {
        abort_unless($credential->provider?->key === 'openrouter', 404);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'api_key' => ['nullable', 'string', 'min:12', 'max:500'],
            'status' => ['sometimes', Rule::in(['active', 'disabled'])],
            'priority' => ['sometimes', 'integer', 'min:0', 'max:10000'],
            'weight' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ]);

        if (array_key_exists('api_key', $validated) && filled($validated['api_key'])) {
            $secret = trim($validated['api_key']);
            $validated['secret'] = $secret;
            $validated['key_hint'] = substr($secret, -4);
        }
        unset($validated['api_key']);

        $credential->update($validated);

        return response()->json([
            'message' => 'OpenRouter credential updated.',
            'credential' => $this->credentialPayload($credential->fresh()),
        ]);
    }

    public function destroyCredential(AiCredential $credential): JsonResponse
    {
        abort_unless($credential->provider?->key === 'openrouter', 404);
        $credential->delete();

        return response()->json(['message' => 'OpenRouter credential removed.']);
    }

    public function storeModel(Request $request): JsonResponse
    {
        $provider = $this->provider();
        $validated = $this->validateModel($request);

        $model = $provider->models()->create($validated);

        return response()->json([
            'message' => 'AI model added.',
            'model' => $this->modelPayload($model),
        ], 201);
    }

    public function updateModel(Request $request, AiModel $model): JsonResponse
    {
        abort_unless($model->provider?->key === 'openrouter', 404);
        $model->update($this->validateModel($request, true));

        return response()->json([
            'message' => 'AI model updated.',
            'model' => $this->modelPayload($model->fresh()),
        ]);
    }

    public function destroyModel(AiModel $model): JsonResponse
    {
        abort_unless($model->provider?->key === 'openrouter', 404);
        if (AiTaskRoute::query()->where('primary_model_id', $model->id)->exists()) {
            return response()->json(['message' => 'Remove this model from task routes before deleting it.'], 422);
        }

        $model->delete();

        return response()->json(['message' => 'AI model removed.']);
    }

    public function updateTask(Request $request, AiTaskRoute $taskRoute): JsonResponse
    {
        $provider = $this->provider();
        $validated = $request->validate([
            'primary_model_id' => ['nullable', 'integer', Rule::exists('ai_models', 'id')->where('ai_provider_id', $provider->id)],
            'fallback_model_ids' => ['nullable', 'array', 'max:5'],
            'fallback_model_ids.*' => ['integer', Rule::exists('ai_models', 'id')->where('ai_provider_id', $provider->id)],
            'credit_cost' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $taskRoute->update([
            'primary_model_id' => $validated['primary_model_id'] ?? null,
            'fallback_model_ids' => array_values(array_unique(array_map('intval', $validated['fallback_model_ids'] ?? []))),
            'credit_cost' => $validated['credit_cost'] ?? $taskRoute->credit_cost,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $taskRoute->is_active,
        ]);

        return response()->json([
            'message' => 'AI task route updated.',
            'task' => [
                'id' => $taskRoute->id,
                'task_key' => $taskRoute->task_key,
                'primary_model_id' => $taskRoute->primary_model_id,
                'fallback_model_ids' => $taskRoute->fallback_model_ids ?: [],
                'credit_cost' => $taskRoute->credit_cost,
                'is_active' => $taskRoute->is_active,
            ],
        ]);
    }

    public function storePlan(Request $request): JsonResponse
    {
        $validated = $this->validatePlan($request);
        $plan = AiPlan::create($validated);

        return response()->json([
            'message' => 'AI plan added.',
            'plan' => $this->planPayload($plan->load('limits')),
        ], 201);
    }

    public function updatePlan(Request $request, AiPlan $aiPlan): JsonResponse
    {
        $aiPlan->update($this->validatePlan($request, true));

        return response()->json([
            'message' => 'AI plan updated.',
            'plan' => $this->planPayload($aiPlan->fresh('limits')),
        ]);
    }

    public function storeSubscription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ai_plan_id' => ['required', 'integer', Rule::exists('ai_plans', 'id')],
            'scope_type' => ['required', Rule::in(['user', 'merchant'])],
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'merchant_id' => ['nullable', 'integer', Rule::exists('merchants', 'id')],
            'status' => ['nullable', Rule::in(['active', 'paused', 'cancelled', 'expired'])],
            'current_period_start' => ['nullable', 'date'],
            'current_period_end' => ['nullable', 'date', 'after_or_equal:current_period_start'],
            'source_type' => ['nullable', 'string', 'max:80'],
            'source_id' => ['nullable', 'integer'],
        ]);

        $plan = AiPlan::query()->findOrFail($validated['ai_plan_id']);
        abort_unless($plan->scope_type === $validated['scope_type'], 422, 'The AI plan scope must match the subscription owner.');
        if ($validated['scope_type'] === 'user') {
            abort_unless(! empty($validated['user_id']) && empty($validated['merchant_id']), 422, 'A user subscription needs a user owner only.');
        } else {
            abort_unless(! empty($validated['merchant_id']) && empty($validated['user_id']), 422, 'A merchant subscription needs a business owner only.');
        }

        $subscription = AiSubscription::create(array_merge($validated, [
            'status' => $validated['status'] ?? 'active',
        ]));

        return response()->json([
            'message' => 'AI subscription assigned.',
            'subscription' => $this->subscriptionPayload($subscription->load('plan')),
        ], 201);
    }

    public function upsertPlanLimit(Request $request, AiPlan $aiPlan, string $taskKey): JsonResponse
    {
        abort_unless(AiTaskRoute::query()->where('task_key', $taskKey)->exists(), 404);

        $validated = $request->validate([
            'included_units' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'credit_cost_override' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'period' => ['nullable', Rule::in(['billing_period', 'daily', 'monthly', 'lifetime'])],
            'is_enabled' => ['required', 'boolean'],
        ]);

        $limit = $aiPlan->limits()->updateOrCreate(
            ['task_key' => $taskKey],
            [
                'included_units' => $validated['included_units'] ?? null,
                'credit_cost_override' => $validated['credit_cost_override'] ?? null,
                'period' => $validated['period'] ?? 'billing_period',
                'is_enabled' => (bool) $validated['is_enabled'],
            ],
        );

        return response()->json([
            'message' => 'AI plan task allowance updated.',
            'limit' => [
                'task_key' => $limit->task_key,
                'included_units' => $limit->included_units,
                'credit_cost_override' => $limit->credit_cost_override,
                'period' => $limit->period,
                'is_enabled' => $limit->is_enabled,
            ],
        ]);
    }

    public function destroyPlanLimit(AiPlan $aiPlan, string $taskKey): JsonResponse
    {
        $aiPlan->limits()->where('task_key', $taskKey)->delete();

        return response()->json(['message' => 'AI plan task allowance removed.']);
    }

    private function provider(): AiProvider
    {
        return AiProvider::query()->where('key', 'openrouter')->firstOrFail();
    }

    private function validateModel(Request $request, bool $partial = false): array
    {
        $rules = [
            'model_key' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'label' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'capabilities' => [$partial ? 'sometimes' : 'required', 'array', 'min:1'],
            'capabilities.*' => ['string', 'max:80'],
            'input_cost_per_million' => ['nullable', 'numeric', 'min:0'],
            'output_cost_per_million' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];

        $validated = $request->validate($rules);
        if (array_key_exists('capabilities', $validated)) {
            $validated['capabilities'] = array_values(array_unique(array_map('strval', $validated['capabilities'])));
        }

        return $validated;
    }

    private function credentialPayload(AiCredential $credential): array
    {
        return [
            'id' => $credential->id,
            'name' => $credential->name,
            'key_hint' => $credential->maskedKey(),
            'status' => $credential->status,
            'priority' => (int) $credential->priority,
            'weight' => (int) $credential->weight,
            'failure_count' => (int) $credential->failure_count,
            'last_used_at' => $credential->last_used_at?->toISOString(),
            'disabled_until' => $credential->disabled_until?->toISOString(),
        ];
    }

    private function modelPayload(AiModel $model): array
    {
        return [
            'id' => $model->id,
            'model_key' => $model->model_key,
            'label' => $model->label,
            'capabilities' => $model->capabilities ?: [],
            'input_cost_per_million' => $model->input_cost_per_million,
            'output_cost_per_million' => $model->output_cost_per_million,
            'is_active' => $model->is_active,
        ];
    }

    private function validatePlan(Request $request, bool $partial = false): array
    {
        $rules = [
            'key' => [$partial ? 'sometimes' : 'required', 'string', 'alpha_dash', 'max:80', Rule::unique('ai_plans', 'key')->ignore($request->route('aiPlan'))],
            'scope_type' => [$partial ? 'sometimes' : 'nullable', Rule::in(['user', 'merchant'])],
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'feature_group' => ['nullable', 'string', 'max:120'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'currency_code' => ['nullable', 'string', 'size:3'],
            'billing_interval' => ['nullable', Rule::in(['monthly', 'annual', 'one_time'])],
            'claim_frequency' => ['nullable', Rule::in(['once', 'daily', 'weekly', 'monthly'])],
            'included_credits' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'overage_allowed' => ['nullable', 'boolean'],
            'overage_credit_price' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:10000'],
        ];

        $validated = $request->validate($rules);
        if (isset($validated['currency_code'])) {
            $validated['currency_code'] = strtoupper($validated['currency_code']);
        }
        if (! $partial) {
            $validated['scope_type'] ??= 'user';
        }

        return $validated;
    }

    private function planPayload(AiPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'key' => $plan->key,
            'scope_type' => $plan->scope_type,
            'name' => $plan->name,
            'description' => $plan->description,
            'feature_group' => $plan->feature_group,
            'price' => $plan->price,
            'currency_code' => $plan->currency_code,
            'billing_interval' => $plan->billing_interval,
            'claim_frequency' => $plan->claim_frequency,
            'included_credits' => $plan->included_credits,
            'overage_allowed' => $plan->overage_allowed,
            'overage_credit_price' => $plan->overage_credit_price,
            'is_active' => $plan->is_active,
            'sort_order' => $plan->sort_order,
            'limits' => $plan->limits?->map(fn ($limit) => [
                'task_key' => $limit->task_key,
                'included_units' => $limit->included_units,
                'credit_cost_override' => $limit->credit_cost_override,
                'period' => $limit->period,
                'is_enabled' => $limit->is_enabled,
            ])->values() ?: [],
        ];
    }

    private function subscriptionPayload(AiSubscription $subscription): array
    {
        return [
            'id' => $subscription->id,
            'ai_plan_id' => $subscription->ai_plan_id,
            'plan' => $subscription->plan?->only(['id', 'key', 'name', 'scope_type']),
            'scope_type' => $subscription->scope_type,
            'user_id' => $subscription->user_id,
            'merchant_id' => $subscription->merchant_id,
            'status' => $subscription->status,
            'current_period_start' => $subscription->current_period_start?->toISOString(),
            'current_period_end' => $subscription->current_period_end?->toISOString(),
            'source_type' => $subscription->source_type,
            'claim_key' => $subscription->claim_key,
        ];
    }
}
