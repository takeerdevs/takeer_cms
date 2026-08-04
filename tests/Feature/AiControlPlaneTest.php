<?php

namespace Tests\Feature;

use Carbon\Carbon;
use App\Models\AiCredential;
use App\Models\AiPlan;
use App\Models\AiProvider;
use App\Models\AiSubscription;
use App\Models\AiUsageRecord;
use App\Models\Merchant;
use App\Models\Product;
use App\Models\ProductAttribute;
use App\Models\User;
use App\Services\AiCreditService;
use App\Services\AiTaskRouter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiControlPlaneTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_ai_surface_is_openrouter_task_based_and_does_not_expose_gemini_settings(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->getJson('/admin/api/ai')
            ->assertOk()
            ->assertJsonPath('provider.key', 'openrouter')
            ->assertJsonPath('tasks.0.task_key', 'ai_search')
            ->assertJsonPath('tasks.0.required_capability', 'tools')
            ->assertJsonMissingPath('gemini_api_key')
            ->assertJsonMissingPath('gemini_default_model');
    }

    public function test_admin_can_add_an_encrypted_openrouter_key_without_receiving_the_secret_back(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)->postJson('/admin/api/ai/credentials', [
            'name' => 'Primary test key',
            'api_key' => 'sk-or-v1-test-secret-123456',
            'priority' => 10,
            'weight' => 100,
        ]);

        $response->assertCreated()
            ->assertJsonPath('credential.name', 'Primary test key')
            ->assertJsonMissing(['api_key' => 'sk-or-v1-test-secret-123456']);

        $credential = AiCredential::query()->where('name', 'Primary test key')->firstOrFail();
        $storedSecret = DB::table('ai_credentials')->where('id', $credential->id)->value('secret');
        $this->assertNotSame('sk-or-v1-test-secret-123456', $storedSecret);
        $this->assertSame('sk-or-v1-test-secret-123456', $credential->secret);
    }

    public function test_admin_can_create_a_platform_ai_plan(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->postJson('/admin/api/ai/plans', [
            'key' => 'creator',
            'name' => 'Creator AI',
            'price' => 25000,
            'currency_code' => 'tzs',
            'billing_interval' => 'monthly',
            'claim_frequency' => 'weekly',
            'included_credits' => 100,
            'overage_allowed' => true,
            'overage_credit_price' => 250,
        ])->assertCreated()->assertJsonPath('plan.key', 'creator');

        $this->assertDatabaseHas('ai_plans', [
            'key' => 'creator',
            'currency_code' => 'TZS',
            'included_credits' => 100,
            'claim_frequency' => 'weekly',
        ]);

        $merchantPlan = AiPlan::create([
            'key' => 'merchant-creator',
            'scope_type' => 'merchant',
            'name' => 'Merchant Creator AI',
            'included_credits' => 50,
            'is_active' => true,
        ]);
        $this->actingAs($admin)->patchJson('/admin/api/ai/plans/'.$merchantPlan->id, [
            'claim_frequency' => 'daily',
        ])->assertOk();
        $this->assertDatabaseHas('ai_plans', [
            'id' => $merchantPlan->id,
            'scope_type' => 'merchant',
            'claim_frequency' => 'daily',
        ]);
    }

    public function test_ai_router_uses_the_database_key_and_task_model_and_records_usage(): void
    {
        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'id' => 'gen-test-123',
                'choices' => [[
                    'message' => ['content' => '{"category":"shirts"}'],
                ]],
                'usage' => ['prompt_tokens' => 100, 'completion_tokens' => 25],
            ]),
        ]);

        $provider = AiProvider::query()->where('key', 'openrouter')->firstOrFail();
        $model = $provider->models()->firstOrFail();
        $credential = $provider->credentials()->create([
            'name' => 'Router test key',
            'secret' => 'sk-or-v1-router-secret-123456',
            'key_hint' => '3456',
            'status' => 'active',
        ]);
        $user = User::factory()->create();

        $result = app(AiTaskRouter::class)->chatForTask(
            [['role' => 'user', 'content' => 'test']],
            'product_information_extraction',
            null,
            ['user_id' => $user->id]
        );

        $this->assertSame('{"category":"shirts"}', $result['choices'][0]['message']['content']);
        Http::assertSent(function ($request) use ($model) {
            return $request->url() === 'https://openrouter.ai/api/v1/chat/completions'
                && $request->header('Authorization')[0] === 'Bearer sk-or-v1-router-secret-123456'
                && $request->data()['model'] === $model->model_key;
        });
        $this->assertDatabaseHas('ai_usage_records', [
            'user_id' => $user->id,
            'task_key' => 'product_information_extraction',
            'ai_credential_id' => $credential->id,
            'provider_request_id' => 'gen-test-123',
            'status' => 'completed',
        ]);
        $this->assertEquals(0, AiUsageRecord::query()->where('ai_credential_id', $credential->id)->firstOrFail()->charged_credits + 0);
    }

    public function test_credit_service_reserves_settles_and_releases_without_double_charging(): void
    {
        $user = User::factory()->create();
        $credits = app(AiCreditService::class);
        $credits->credit($user, 10, 'seed-credits');

        $reservation = $credits->reserve($user, 3, 'try-on-request-1', 'virtual_try_on');
        $account = $reservation->account()->firstOrFail();
        $this->assertSame(7.0, (float) $account->balance);
        $this->assertSame(3.0, (float) $account->reserved_balance);

        $credits->settle($reservation);
        $credits->settle($reservation);
        $account->refresh();
        $this->assertSame(7.0, (float) $account->balance);
        $this->assertSame(0.0, (float) $account->reserved_balance);

        $second = $credits->reserve($user, 2, 'try-on-request-2', 'virtual_try_on');
        $credits->release($second);
        $account->refresh();
        $this->assertSame(7.0, (float) $account->balance);
        $this->assertSame(0.0, (float) $account->reserved_balance);
    }

    public function test_ai_access_keeps_user_and_merchant_wallets_separate_and_grants_subscription_credits_once(): void
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'ai-merchant-'.uniqid(),
            'display_name' => 'AI Merchant',
            'is_default' => true,
            'is_active' => true,
        ]);
        $plan = AiPlan::create([
            'key' => 'merchant-catalog',
            'scope_type' => 'merchant',
            'name' => 'Merchant Catalog AI',
            'included_credits' => 8,
            'is_active' => true,
        ]);
        $plan->limits()->create([
            'task_key' => 'product_information_extraction',
            'included_units' => 10,
            'is_enabled' => true,
        ]);
        AiSubscription::create([
            'ai_plan_id' => $plan->id,
            'scope_type' => 'merchant',
            'merchant_id' => $merchant->id,
            'status' => 'active',
            'current_period_start' => now()->startOfMonth(),
            'current_period_end' => now()->endOfMonth(),
        ]);

        $credits = app(AiCreditService::class);
        $access = $credits->accessFor($user, 'product_information_extraction', $merchant);

        $this->assertTrue($access['allowed']);
        $this->assertSame('merchant', $access['scope_type']);
        $this->assertSame(8.0, (float) $credits->accountForMerchant($merchant)->balance);
        $this->assertSame(0.0, (float) $credits->accountFor($user)->balance);

        $credits->accessFor($user, 'product_information_extraction', $merchant);
        $this->assertSame(1, DB::table('ai_credit_transactions')->where('transaction_type', 'credit')->count());
    }

    public function test_user_can_claim_free_ai_credits_once_per_window(): void
    {
        $user = User::factory()->create();
        $plan = AiPlan::query()->where('key', 'free')->firstOrFail();
        $plan->update(['included_credits' => 100]);
        $plan->limits()->updateOrCreate(
            ['task_key' => 'ai_search'],
            ['included_units' => 100, 'credit_cost_override' => 1, 'period' => 'billing_period', 'is_enabled' => true],
        );

        $first = $this->actingAs($user)->postJson('/api/ai/claim-free');
        $first->assertOk()
            ->assertJsonPath('status', 'claimed')
            ->assertJsonPath('claimed', true)
            ->assertJsonPath('credits_granted', 100)
            ->assertJsonPath('access.allowed', true);

        $this->assertDatabaseCount('ai_subscriptions', 1);
        $this->assertDatabaseCount('ai_credit_grants', 1);
        $this->assertDatabaseCount('ai_credit_transactions', 1);
        $this->assertSame(100.0, (float) app(AiCreditService::class)->accountFor($user)->balance);

        $second = $this->actingAs($user)->postJson('/api/ai/claim-free');
        $second->assertOk()
            ->assertJsonPath('status', 'already_claimed')
            ->assertJsonPath('already_claimed', true)
            ->assertJsonPath('credits_granted', 0)
            ->assertJsonPath('access.allowed', true);

        $this->assertDatabaseCount('ai_subscriptions', 1);
        $this->assertDatabaseCount('ai_credit_grants', 1);
        $this->assertDatabaseCount('ai_credit_transactions', 1);
    }

    public function test_free_claim_credits_expire_and_reset_in_the_next_window(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-04 12:00:00'));

        try {
            $user = User::factory()->create();
            $plan = AiPlan::query()->where('key', 'free')->firstOrFail();
            $plan->update(['included_credits' => 5]);
            $plan->limits()->updateOrCreate(
                ['task_key' => 'ai_search'],
                ['included_units' => 5, 'credit_cost_override' => 1, 'period' => 'billing_period', 'is_enabled' => true],
            );

            $this->actingAs($user)->postJson('/api/ai/claim-free')->assertOk();
            $this->assertSame(5.0, (float) app(AiCreditService::class)->accountFor($user)->balance);

            Carbon::setTestNow(Carbon::parse('2026-09-01 12:00:00'));
            $next = $this->actingAs($user)->postJson('/api/ai/claim-free');
            $next->assertOk()
                ->assertJsonPath('status', 'claimed')
                ->assertJsonPath('credits_granted', 5)
                ->assertJsonPath('access.allowed', true);

            $this->assertDatabaseCount('ai_subscriptions', 2);
            $this->assertDatabaseCount('ai_credit_grants', 2);
            $this->assertDatabaseHas('ai_credit_transactions', ['transaction_type' => 'expire', 'amount' => 5]);
            $this->assertSame(5.0, (float) app(AiCreditService::class)->accountFor($user)->balance);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_free_claim_frequency_controls_daily_weekly_monthly_and_once_windows(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-04 12:00:00'));

        try {
            $plan = AiPlan::query()->where('key', 'free')->firstOrFail();
            $plan->update(['included_credits' => 2]);
            $plan->limits()->updateOrCreate(
                ['task_key' => 'ai_search'],
                ['included_units' => 2, 'credit_cost_override' => 1, 'period' => 'billing_period', 'is_enabled' => true],
            );

            $windows = [
                ['frequency' => 'daily', 'next' => '2026-08-05 12:00:00'],
                ['frequency' => 'weekly', 'next' => '2026-08-10 12:00:00'],
                ['frequency' => 'monthly', 'next' => '2026-09-01 12:00:00'],
            ];

            foreach ($windows as $window) {
                $plan->update(['claim_frequency' => $window['frequency']]);
                $user = User::factory()->create();
                $this->actingAs($user)->postJson('/api/ai/claim-free')->assertJsonPath('status', 'claimed');

                Carbon::setTestNow(Carbon::parse($window['next']));
                $this->actingAs($user)->postJson('/api/ai/claim-free')
                    ->assertOk()
                    ->assertJsonPath('status', 'claimed');
                Carbon::setTestNow(Carbon::parse('2026-08-04 12:00:00'));
            }

            $plan->update(['claim_frequency' => 'once']);
            $user = User::factory()->create();
            $this->actingAs($user)->postJson('/api/ai/claim-free')->assertJsonPath('status', 'claimed');
            Carbon::setTestNow(Carbon::parse('2027-08-04 12:00:00'));
            $this->actingAs($user)->postJson('/api/ai/claim-free')
                ->assertOk()
                ->assertJsonPath('status', 'already_claimed');
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_admin_ai_usage_report_can_filter_by_model_and_task(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        AiUsageRecord::create([
            'user_id' => $admin->id,
            'actor_user_id' => $admin->id,
            'scope_type' => 'user',
            'task_key' => 'ai_search',
            'provider_key' => 'openrouter',
            'model_key' => 'openai/gpt-5-mini',
            'status' => 'completed',
            'input_units' => 100,
            'output_units' => 50,
            'billable_units' => 1,
            'provider_cost' => 0.0025,
            'charged_credits' => 1,
            'latency_ms' => 320,
        ]);

        $this->actingAs($admin)->getJson('/admin/api/ai/usage?task_key=ai_search&model_key=openai%2Fgpt-5-mini')
            ->assertOk()
            ->assertJsonPath('summary.requests', 1)
            ->assertJsonPath('summary.successful_requests', 1)
            ->assertJsonPath('by_task.0.key', 'ai_search')
            ->assertJsonPath('by_model.0.key', 'openai/gpt-5-mini');
    }

    public function test_ai_router_records_failed_provider_attempts_for_auditability(): void
    {
        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response(['error' => ['message' => 'quota']], 429),
        ]);

        $provider = AiProvider::query()->where('key', 'openrouter')->firstOrFail();
        $model = $provider->models()->firstOrFail();
        $credential = $provider->credentials()->create([
            'name' => 'Failure audit key',
            'secret' => 'sk-or-v1-failure-audit-123456',
            'key_hint' => '3456',
            'status' => 'active',
        ]);
        $user = User::factory()->create();

        try {
            app(AiTaskRouter::class)->chatForTask(
                [['role' => 'user', 'content' => 'test']],
                'product_information_extraction',
                null,
                ['user_id' => $user->id, 'actor_user_id' => $user->id]
            );
        } catch (\RuntimeException) {
            // Expected: the only configured provider attempt returns 429.
        }

        $this->assertDatabaseHas('ai_usage_records', [
            'user_id' => $user->id,
            'task_key' => 'product_information_extraction',
            'ai_credential_id' => $credential->id,
            'status' => 'failed',
            'error_code' => 'provider_error',
        ]);
    }

    public function test_ai_search_copilot_executes_catalog_tool_streams_ui_and_settles_one_credit(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'copilot-merchant-'.uniqid(),
            'display_name' => 'Copilot Store',
            'is_default' => true,
            'is_active' => true,
            'is_suspended' => false,
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Blue linen shirt',
            'slug' => 'blue-linen-shirt-'.uniqid(),
            'type' => 'physical',
            'price' => 65000,
            'inventory_count' => 4,
        ]);
        ProductAttribute::create([
            'product_id' => $product->id,
            'category' => 'shirts',
            'colors' => ['blue'],
            'material' => 'linen',
        ]);

        $plan = AiPlan::create([
            'key' => 'copilot-user',
            'scope_type' => 'user',
            'name' => 'Copilot User',
            'included_credits' => 10,
            'is_active' => true,
        ]);
        AiSubscription::create([
            'ai_plan_id' => $plan->id,
            'scope_type' => 'user',
            'user_id' => $user->id,
            'status' => 'active',
            'current_period_start' => now()->startOfMonth(),
            'current_period_end' => now()->endOfMonth(),
        ]);

        $provider = AiProvider::query()->where('key', 'openrouter')->firstOrFail();
        $provider->models()->firstOrFail()->update(['capabilities' => ['text', 'vision', 'structured_output', 'tools']]);
        $provider->credentials()->create([
            'name' => 'Copilot stream key',
            'secret' => 'sk-or-v1-copilot-stream-123456',
            'key_hint' => '3456',
            'status' => 'active',
        ]);

        $toolCall = implode("\n\n", [
            'data: '.json_encode([
                'id' => 'gen-copilot-tool',
                'choices' => [[
                    'delta' => [
                        'role' => 'assistant',
                        'tool_calls' => [[
                            'index' => 0,
                            'id' => 'call-products',
                            'type' => 'function',
                            'function' => ['name' => 'search_products', 'arguments' => '{"query":"blue shirt","limit":2}'],
                        ]],
                    ],
                    'finish_reason' => 'tool_calls',
                ]],
            ], JSON_UNESCAPED_SLASHES),
            'data: [DONE]',
        ])."\n\n";
        $finalAnswer = implode("\n\n", [
            'data: '.json_encode([
                'id' => 'gen-copilot-final',
                'choices' => [[
                    'delta' => ['role' => 'assistant', 'content' => 'Nimepata shati la blue.'],
                    'finish_reason' => 'stop',
                ]],
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'data: '.json_encode([
                'id' => 'gen-copilot-final',
                'choices' => [],
                'usage' => ['prompt_tokens' => 120, 'completion_tokens' => 24],
            ], JSON_UNESCAPED_SLASHES),
            'data: [DONE]',
        ])."\n\n";
        $calls = 0;
        Http::fake(function ($request) use (&$calls, $toolCall, $finalAnswer) {
            $calls++;

            return Http::response($calls === 1 ? $toolCall : $finalAnswer, 200, ['Content-Type' => 'text/event-stream']);
        });

        $response = $this->actingAs($user)->postJson('/api/ai/search/chat', [
            'message' => 'Nata shati la blue',
        ]);

        $response->assertOk();
        $this->assertStringContainsString('event: ui', $response->streamedContent());
        $this->assertStringContainsString('Blue linen shirt', $response->streamedContent());
        $this->assertStringContainsString('event: done', $response->streamedContent());
        $this->assertSame(2, $calls);
        $this->assertSame(2, AiUsageRecord::query()->where('task_key', 'ai_search')->where('user_id', $user->id)->count());
        $this->assertSame(1.0, (float) AiUsageRecord::query()->where('user_id', $user->id)->where('charged_credits', 1)->value('charged_credits'));
        $this->assertSame(9.0, (float) app(AiCreditService::class)->accountFor($user)->balance);
    }

    public function test_ai_search_releases_credit_and_explains_when_no_tool_capable_model_is_configured(): void
    {
        $user = User::factory()->create();
        $plan = AiPlan::create([
            'key' => 'tool-required-user',
            'scope_type' => 'user',
            'name' => 'Tool Required User',
            'included_credits' => 1,
            'is_active' => true,
        ]);
        AiSubscription::create([
            'ai_plan_id' => $plan->id,
            'scope_type' => 'user',
            'user_id' => $user->id,
            'status' => 'active',
            'current_period_start' => now()->startOfMonth(),
            'current_period_end' => now()->endOfMonth(),
        ]);

        AiProvider::query()->where('key', 'openrouter')->firstOrFail()->models()->firstOrFail()->update([
            'capabilities' => ['vision', 'structured_output'],
        ]);

        $response = $this->actingAs($user)->postJson('/api/ai/search/chat', [
            'message' => 'Nata shati la blue',
        ]);

        $response->assertOk();
        $this->assertStringContainsString('"code":"model_route_unavailable"', $response->streamedContent());
        $this->assertSame(1.0, (float) app(AiCreditService::class)->accountFor($user)->balance);
        $this->assertSame(0.0, (float) app(AiCreditService::class)->accountFor($user)->reserved_balance);
    }
}
