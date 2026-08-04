<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use App\Models\ProductEmbedding;
use App\Models\AiUsageRecord;
use App\Services\AiCreditService;
use App\Services\AiSearchSystemPrompt;
use App\Services\AiSearchToolRegistry;
use App\Services\OpenRouterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AiSearchController extends Controller
{
    public function __construct(
        private OpenRouterService $ai,
        private AiCreditService $credits,
        private AiSearchToolRegistry $tools,
    )
    {
    }

    public function access(Request $request): JsonResponse
    {
        $taskKey = (string) $request->query('task', 'ai_search');
        abort_unless(in_array($taskKey, ['ai_search'], true), 404);

        return response()->json($this->credits->accessFor($request->user(), $taskKey));
    }

    public function claimFree(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json([
                'message' => 'Sign in to claim free AI credits.',
                'code' => 'authentication_required',
            ], 401);
        }

        $result = $this->credits->claimFreePlan($user, 'ai_search');
        $status = match ($result['status']) {
            'unavailable' => 422,
            'active_subscription' => 409,
            default => 200,
        };

        return response()->json(array_merge($result, [
            'message' => match ($result['status']) {
                'claimed' => 'Free AI credits added to your account.',
                'already_claimed' => 'Your free AI credits are already active for this window.',
                'active_subscription' => 'An AI subscription is already active on this account.',
                default => 'Free AI credits are not available right now.',
            },
        ]), $status);
    }

    /**
     * POST /api/ai/search/chat
     *
     * A bounded agentic loop over Takeer-owned commerce tools. The provider
     * response is streamed as server-sent events, while tool execution stays
     * on this server and every model round is recorded by the AI router.
     */
    public function chat(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1200',
            'conversation_id' => 'nullable|string|max:80',
            'history' => 'nullable|array|max:12',
            'history.*.role' => 'required|string|in:user,assistant',
            'history.*.content' => 'nullable|string|max:4000',
        ]);

        $user = $request->user();
        $access = $this->credits->accessFor($user, 'ai_search');
        if (! $user) {
            return response()->json([
                'message' => 'Sign in to use AI search.',
                'code' => 'ai_access_required',
                'access' => $access,
                'fallback_url' => '/search?q='.rawurlencode($validated['message']),
            ], 401);
        }

        if (! $access['allowed']) {
            return response()->json([
                'message' => 'AI search is not available for this account yet.',
                'code' => 'ai_access_required',
                'access' => $access,
                'fallback_url' => '/search?q='.rawurlencode($validated['message']),
            ], 402);
        }

        $conversationId = (string) ($validated['conversation_id'] ?? Str::uuid());
        $turnId = (string) Str::uuid();
        $reservation = $this->credits->reserveTask($user, 'ai_search', 'ai-search-chat:'.$turnId);
        $history = collect($validated['history'] ?? [])
            ->map(fn (array $message): array => [
                'role' => $message['role'],
                'content' => trim((string) ($message['content'] ?? '')),
            ])
            ->filter(fn (array $message): bool => $message['content'] !== '')
            ->take(-10)
            ->values()
            ->all();
        $messages = array_merge([
            ['role' => 'system', 'content' => AiSearchSystemPrompt::make()],
        ], $history, [[
            'role' => 'user',
            'content' => trim($validated['message']),
        ]]);

        return response()->stream(function () use ($messages, $user, $conversationId, $turnId, $reservation): void {
            $settled = false;
            $emit = static function (string $event, array $data): void {
                echo 'event: '.$event."\n";
                echo 'data: '.json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n\n";
                @ob_flush();
                flush();
            };

            try {
                $emit('ready', [
                    'conversation_id' => $conversationId,
                    'turn_id' => $turnId,
                ]);
                $emit('status', ['state' => 'thinking']);

                $loopMessages = $messages;
                $finalResponse = null;
                $maxRounds = 4;

                for ($round = 0; $round < $maxRounds; $round++) {
                    $response = $this->ai->streamForTask(
                        $loopMessages,
                        'ai_search',
                        null,
                        [
                            'user_id' => $user->id,
                            'actor_user_id' => $user->id,
                            'scope_type' => 'user',
                            'required_capability' => 'tools',
                            'billable_units' => 0,
                            'unit_type' => 'query',
                            'charged_credits' => 0,
                            'metadata' => [
                                'conversation_id' => $conversationId,
                                'turn_id' => $turnId,
                                'agent_round' => $round + 1,
                                'tool_mode' => true,
                            ],
                            'payload' => [
                                'tools' => $this->tools->definitions(),
                                'tool_choice' => 'auto',
                                'parallel_tool_calls' => false,
                                'temperature' => 0.2,
                                'max_tokens' => 900,
                                'stream_options' => ['include_usage' => true],
                            ],
                        ],
                        fn (string $delta) => $emit('message', ['delta' => $delta]),
                    );

                    $assistant = $response['choices'][0]['message'] ?? [];
                    $toolCalls = is_array($assistant['tool_calls'] ?? null) ? $assistant['tool_calls'] : [];
                    if ($toolCalls === []) {
                        $finalResponse = $assistant;
                        break;
                    }

                    $loopMessages[] = [
                        'role' => 'assistant',
                        'content' => $assistant['content'] ?? null,
                        'tool_calls' => $toolCalls,
                    ];

                    foreach ($toolCalls as $toolCall) {
                        $toolName = (string) data_get($toolCall, 'function.name', '');
                        $toolCallId = (string) ($toolCall['id'] ?? Str::uuid());
                        $arguments = json_decode((string) data_get($toolCall, 'function.arguments', '{}'), true);
                        $arguments = is_array($arguments) ? $arguments : [];

                        $emit('tool', [
                            'name' => $toolName,
                            'state' => 'running',
                        ]);
                        $result = $this->tools->execute($toolName, $arguments);
                        if (is_array($result['ui'] ?? null)) {
                            $emit('ui', $result['ui']);
                        }
                        $emit('tool', [
                            'name' => $toolName,
                            'state' => 'complete',
                        ]);

                        $loopMessages[] = [
                            'role' => 'tool',
                            'tool_call_id' => $toolCallId,
                            'content' => json_encode($result['model'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        ];
                    }

                    $emit('status', ['state' => 'writing']);
                }

                if (! is_array($finalResponse) || blank($finalResponse['content'] ?? null)) {
                    throw new \RuntimeException('The AI search assistant did not return a final answer.');
                }

                $usage = AiUsageRecord::query()
                    ->where('task_key', 'ai_search')
                    ->where('user_id', $user->id)
                    ->where('status', 'completed')
                    ->where('metadata->turn_id', $turnId)
                    ->latest('id')
                    ->first();
                $this->credits->settle($reservation, $usage);
                $settled = true;

                $emit('done', [
                    'conversation_id' => $conversationId,
                    'turn_id' => $turnId,
                    'usage_record_id' => $usage?->id,
                ]);
            } catch (Throwable $exception) {
                if (! $settled) {
                    $this->credits->release($reservation, [
                        'reason' => 'provider_or_tool_failure',
                        'turn_id' => $turnId,
                    ]);
                }

                Log::error('AI commerce copilot failed', [
                    'turn_id' => $turnId,
                    'user_id' => $user->id,
                    'error_code' => $this->publicErrorCode($exception),
                    'error' => $exception->getMessage(),
                ]);
                $errorCode = $this->publicErrorCode($exception);
                $emit('error', [
                    'code' => $errorCode,
                    'message' => $this->publicErrorMessage($errorCode),
                    'fallback_url' => '/search?q='.rawurlencode((string) ($messages[array_key_last($messages)]['content'] ?? '')),
                ]);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function publicErrorCode(Throwable $exception): string
    {
        $message = strtolower($exception->getMessage());

        if (str_contains($message, 'no active ai model') || str_contains($message, 'route succeeded')) {
            return 'model_route_unavailable';
        }

        if (str_contains($message, 'http 429') || str_contains($message, 'quota') || str_contains($message, 'rate limit')) {
            return 'provider_quota_exceeded';
        }

        return 'provider_error';
    }

    private function publicErrorMessage(string $errorCode): string
    {
        return match ($errorCode) {
            'model_route_unavailable' => 'AI search is not configured with a tool-capable model yet. You can continue with classic search.',
            'provider_quota_exceeded' => 'AI search is temporarily unavailable because the AI provider quota was reached. You can continue with classic search.',
            default => 'AI search is temporarily unavailable. You can continue with classic search.',
        };
    }

    /**
     * POST /api/search/text
     * Natural Language Search -> Extracted Intent -> SQL/Vector search
     */
    public function textSearch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => 'required|string|max:500',
        ]);

        $userQuery = $validated['query'];
        $access = $this->credits->accessFor($request->user(), 'ai_search');
        if (! $access['allowed']) {
            return response()->json([
                'message' => 'AI search is not available for this account yet.',
                'code' => 'ai_access_required',
                'access' => $access,
                'fallback_url' => '/search?q='.rawurlencode($userQuery),
            ], 402);
        }

        $reservation = $this->credits->reserveTask(
            $request->user(),
            'ai_search',
            'ai-search:'.Str::uuid(),
        );
        $providerSucceeded = false;

        try {
            // 1. LLM extraction through the configured AI task route.
            $messages = [
                ['role' => 'system', 'content' => 'Extract search intent from the user query. Output ONLY a raw JSON object with these keys: "category" (string or null), "max_price" (integer or null), "colors" (array of strings or null). Example: {"category": "viatu", "max_price": 50000, "colors": ["nyeusi"]}'],
                ['role' => 'user', 'content' => $userQuery]
            ];

            $response = $this->ai->forTask($messages, 'ai_search', null, [
                'user_id' => $request->user()->id,
                'actor_user_id' => $request->user()->id,
                'scope_type' => 'user',
                'required_capability' => 'structured_output',
                'billable_units' => 1,
                'unit_type' => 'query',
                'charged_credits' => $reservation->amount,
            ]);
            $providerSucceeded = true;
            $this->credits->settle($reservation);

            // Clean markdown block if present
            $content = $response['choices'][0]['message']['content'];
            $content = str_replace(['```json', '```'], '', $content);
            $parsedIntent = json_decode(trim($content), true);

            // 2. Query Builder based on parsed intent
            $query = Product::with(['attributes', 'merchant'])->where('in_stock', true);

            if (!empty($parsedIntent['category'])) {
                // Approximate search via Postgres ILIKE on json properties
                $query->whereRaw("attributes->>'category' ILIKE ?", ['%' . $parsedIntent['category'] . '%'])
                    ->orWhere('title', 'ILIKE', '%' . $parsedIntent['category'] . '%');
            }

            if (!empty($parsedIntent['max_price'])) {
                $query->where('price', '<=', $parsedIntent['max_price']);
            }

            $products = $query->take(10)->get();

            return response()->json([
                'ai_reply' => count($products) > 0
                    ? "Hizi hapa bidhaa nilizokutafutia kulingana na ulivyoomba."
                    : "Samahani, sijapata bidhaa yenye vigezo hivyo sasa hivi.",
                'intent_extracted' => $parsedIntent,
                'products' => ProductResource::collection($products)->response()->getData(true)['data'],
            ]);

        } catch (Throwable $e) {
            if ($providerSucceeded) {
                $this->credits->settle($reservation);
            } else {
                $this->credits->release($reservation, ['reason' => 'provider_failure']);
            }
            Log::error('AI Text Search Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Mtandao unasumbua, jaribu tena.'], 500);
        }
    }

    /**
     * POST /api/search/visual
     * Upload Image -> OpenRouter Vision -> Extract Text -> Vector/SQL Search
     */
    public function visualSearch(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|image|max:10240', // 10MB
        ]);

        $access = $this->credits->accessFor($request->user(), 'ai_search');
        if (! $access['allowed']) {
            return response()->json([
                'message' => 'AI visual search is not available for this account yet.',
                'code' => 'ai_access_required',
                'access' => $access,
                'fallback_url' => '/search',
            ], 402);
        }

        $reservation = $this->credits->reserveTask(
            $request->user(),
            'ai_search',
            'ai-visual-search:'.Str::uuid(),
        );
        $providerSucceeded = false;

        try {
            // Convert image to Base64
            $imagePath = $request->file('image')->getRealPath();
            $base64Image = base64_encode(file_get_contents($imagePath));
            $mimeType = $request->file('image')->getMimeType();
            $dataUri = "data:{$mimeType};base64,{$base64Image}";

            // 1. Vision processing through the configured AI task route.
            $messages = [
                [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'text', 'text' => 'Analyze this product image. Reply ONLY with a comma separated list of 5 descriptive keywords (colors, style, material, category) in Swahili.'],
                        ['type' => 'image_url', 'image_url' => ['url' => $dataUri]]
                    ]
                ]
            ];

            $response = $this->ai->forTask($messages, 'ai_search', null, [
                'user_id' => $request->user()->id,
                'actor_user_id' => $request->user()->id,
                'scope_type' => 'user',
                'required_capability' => 'vision_json',
                'billable_units' => 1,
                'unit_type' => 'query',
                'charged_credits' => $reservation->amount,
            ]);
            $providerSucceeded = true;
            $this->credits->settle($reservation);
            $keywords = explode(',', $response['choices'][0]['message']['content']);
            $keywords = array_map('trim', $keywords);

            // 2. Basic ILIKE matching on keywords (Since we mocked the pgvector `nearestTo` for now)
            $query = Product::with(['attributes', 'merchant'])->where('in_stock', true);
            foreach ($keywords as $keyword) {
                $query->orWhere('title', 'ILIKE', '%' . $keyword . '%')
                    ->orWhereRaw("attributes->>'category' ILIKE ?", ['%' . $keyword . '%']);
            }

            $products = $query->take(8)->get();

            return response()->json([
                'ai_reply' => 'Nimechanganua picha yako. Je, moja ya hizi ndizo unazotafuta?',
                'keywords_extracted' => $keywords,
                'products' => ProductResource::collection($products)->response()->getData(true)['data'],
            ]);

        } catch (Throwable $e) {
            if ($providerSucceeded) {
                $this->credits->settle($reservation);
            } else {
                $this->credits->release($reservation, ['reason' => 'provider_failure']);
            }
            Log::error('AI Visual Search Failed: ' . $e->getMessage());
            return response()->json(['message' => 'Imeshindwa kuchambua picha.'], 500);
        }
    }
}
