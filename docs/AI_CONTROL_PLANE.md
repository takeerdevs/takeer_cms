# Takeer AI control plane

Takeer treats AI as a platform capability rather than a single model or direct vendor integration.

## Provider policy

OpenRouter is the first active gateway. Direct Gemini configuration has been removed from the admin surface. Gemini models may still be selected through OpenRouter when they are appropriate for a task. Provider credentials are stored in `ai_credentials.secret` using Laravel encrypted casts and are never returned to the browser.

The environment `OPENROUTER_API_KEY` remains a compatibility fallback for bootstrapping and emergency recovery. Normal administration should use the encrypted credential pool so multiple keys can be rotated and isolated.

## Model and task routing

The database separates:

- `ai_models`: model IDs, capabilities, and provider cost metadata.
- `ai_task_routes`: product extraction, photo editing, AI search, OCR, and virtual try-on assignments.
- `ai_credentials`: multiple provider keys with priority, weight, failure tracking, and temporary circuit breaking.

The `AiTaskRouter` selects a task's primary model, then fallbacks, and tries healthy credentials before falling back to the legacy environment key. Existing product extraction, AI search, and waybill OCR calls now use task keys instead of hard-coded model IDs.

Models must advertise the capability required by the task. A vision model is not automatically a photo-editing or image-generation model.

## Credits and subscriptions

Provider cost and user charge are separate concepts. `ai_usage_records` records the provider, credential, model, token units, provider cost, and charged credits. `AiCreditService` supports idempotent crediting, reservation, settlement, and release so retries do not double-charge users.

Platform AI tiers are represented by `ai_plans`, `ai_plan_limits`, and scoped `ai_subscriptions`. The plan's `scope_type` is either `user` or `merchant`, so a buyer's AI search/try-on balance can never silently consume a merchant business's catalog/OCR balance. The older `user_ai_subscriptions` table remains a compatibility read path while subscriptions are migrated.

Each wallet is an `ai_credit_accounts` row. User actions carry `user_id` and `actor_user_id`; merchant actions carry `merchant_id` and the staff/user actor. `AiCreditService::accessFor()` returns a stable entitlement response (`subscription_required`, `feature_not_in_plan`, `allowance_exhausted`, or `credits_required`) for feature prompts. Subscription credits are granted idempotently per billing period, then task credits are reserved, settled, or released.

### Free-credit claims and reset windows

The user-level free plan is not automatically active. A shopper claims the current window from `POST /api/ai/claim-free`. The claim is represented by an `ai_subscriptions` row with a unique `claim_key` such as `free:user:{user}:plan:{plan}:window:{period_start}`. The database lock on the plan plus the unique claim key makes retries and concurrent clicks safe: the first request creates one subscription and one credit grant; later requests return `already_claimed` without adding another grant.

Credit amounts are stored as `ai_credit_grants`, not only as one anonymous wallet balance. Every grant records its source, amount, remaining amount, reservation amount, and optional `expires_at`. Reservations allocate against the earliest-expiring grants first. When a window ends, unused unreserved grants are marked `expired` and an auditable expiration transaction reduces the wallet. A request already in progress may finish; if it fails after expiry, its release does not restore expired credits.

Each plan has an explicit claim frequency independent of its payment billing interval: `once`, `daily`, `weekly`, or `monthly`. `once` creates a lifetime claim key; the other modes create a calendar-window claim key and reset only after that window ends. This allows, for example, an annual paid plan with daily credits or a monthly promotional plan with weekly claims.

The seeded `free` user plan uses monthly claim windows. Its included credits should match its AI Search allowance multiplied by the credit cost (the migration repairs the initial `100 units × 1 credit` configuration to `100` credits). Paid plans can use the same grant mechanism with their billing-period expiry, while permanent top-ups remain non-expiring grants. This keeps future user entitlements, merchant entitlements, promotional credits, and paid top-ups distinct and auditable.

## Audit and reporting

`ai_usage_records` is an attempt ledger, not only a success log. Every provider attempt records:

- task and route version;
- user/merchant scope and actor;
- provider, model, credential hint, attempt number, and fallback reason;
- input/output units, billable unit type, provider-reported or configured pricing snapshot;
- provider cost, charged Takeer credits, latency, status, and bounded error text.

The admin `/admin/ai-usage` screen and `/admin/api/ai/usage` endpoint support date ranges, day/month grouping, task, model, and wallet-scope filters. This makes questions such as “what did `openai/gpt-5-mini` cost this month?” and “how much did product photo editing cost last week?” directly answerable without relying on current routing settings.

The intended request lifecycle is:

1. Resolve the user's active AI plan and task entitlement.
2. Reserve the task's configured credits.
3. Execute through the selected provider/model/key.
4. Record provider cost and request metadata.
5. Settle the reservation on success or release it on failure.

## Commerce copilot search

The search overlay is now a full conversational surface rather than a passive entitlement prompt. Authenticated shoppers POST a message to `/api/ai/search/chat` and receive server-sent events for assistant text, tool progress, catalog UI blocks, and completion status. The endpoint reserves one `ai_search` credit for the shopper's turn and releases it if the provider or tool loop fails.

The model receives only Takeer-owned, read-only tools:

- `search_products` searches active merchant catalog records with bounded query, category, color, and price arguments.
- `get_product_details` reads the public details of a product returned by the catalog.
- `get_product_options` reads public variant and availability information.

The server executes every tool call and sends normalized product cards to the browser. The model cannot send SQL, browse the internet, call arbitrary URLs, mutate inventory, add to cart, or place an order. Product cards can open the product page or open Takeer's existing checkout modal; buying remains an explicit shopper action.

The system instruction is centralized in `App\Services\AiSearchSystemPrompt`. It requires the model to ground every product fact in tool output, respond in the shopper's language, avoid claiming checkout completion, and use classic `/search?q=...` as the fallback when AI access is unavailable. OpenRouter's tool/function calling contract is used for the agent loop, with a maximum of four tool rounds per shopper turn.

Models used by this surface should advertise the `tools` or `function_calling` capability in admin. The canonical `ai_search` route now requires tools; the legacy text and visual search endpoints explicitly override that requirement with `structured_output` and `vision_json` respectively. A provider/model that rejects the tool payload is recorded as a failed attempt and the UI gives the shopper classic search immediately.

Admin subscription assignment is available at `POST /admin/api/ai/subscriptions`; payment checkout and customer-facing plan purchase can now be wired to these tables without changing provider routing.

## Privacy

Do not store raw portraits, product images, prompts, or provider secrets in usage metadata. Image-based tasks should continue using private storage and short-lived result retention. Generated try-on images are approximations and must not be described as a measurement or fit guarantee.
