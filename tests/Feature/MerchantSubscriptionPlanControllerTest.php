<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\ContentItem;
use App\Models\Entitlement;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\UserSubscription;
use App\Http\Resources\PostResource;
use App\Services\SubscriptionRenewalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class MerchantSubscriptionPlanControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_merchant_scoped_members_endpoint_resolves_subscription_plan_after_merchant_segment(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();

        $this->actingAs($user)
            ->getJson("/merchant/{$merchant->username}/subscription-plans/{$plan->id}/members/api")
            ->assertOk()
            ->assertJsonPath('stats.total', 0);
    }

    public function test_merchant_scoped_community_posts_endpoint_resolves_subscription_plan_after_merchant_segment(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();

        $this->actingAs($user)
            ->getJson("/merchant/{$merchant->username}/subscription-plans/{$plan->id}/community-posts/api")
            ->assertOk()
            ->assertJsonPath('count', 0);
    }

    public function test_subscription_renewal_extends_existing_active_period(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $originalEnd = now()->addDay();
        $subscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'auto_renew' => true,
            'started_at' => now()->subDay(),
            'current_period_start' => now()->subDay(),
            'current_period_end' => $originalEnd,
            'next_billing_at' => $originalEnd,
        ]);
        $order = Order::query()->create([
            'buyer_id' => $user->id,
            'merchant_id' => $merchant->id,
            'purchasable_type' => 'subscription_plan',
            'purchasable_id' => $plan->id,
            'unit_price' => 200,
            'total_paid' => 200,
            'payment_status' => 'resolved_merchant_paid',
            'transaction_ref' => 'renew-test-1',
        ]);

        $renewed = app(SubscriptionRenewalService::class)->createOrExtendFromOrder($order);

        $this->assertSame($subscription->id, $renewed->id);
        $this->assertTrue($renewed->current_period_end->greaterThan($originalEnd));
        $this->assertDatabaseHas('subscription_invoices', [
            'user_subscription_id' => $subscription->id,
            'order_id' => $order->id,
            'status' => 'paid',
        ]);
    }

    public function test_orders_library_prefers_direct_purchase_over_subscription_for_same_content(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $content = ContentItem::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Premium Guide',
            'slug' => 'premium-guide',
            'body' => 'Direct purchase should remain separate from membership access.',
            'format' => 'plain_text',
            'visibility' => 'published',
            'moderation_status' => 'approved',
            'published_at' => now(),
        ]);
        $order = Order::query()->create([
            'buyer_id' => $user->id,
            'merchant_id' => $merchant->id,
            'purchasable_type' => 'content_item',
            'purchasable_id' => $content->id,
            'unit_price' => 500,
            'total_paid' => 500,
            'payment_status' => 'resolved_merchant_paid',
            'transaction_ref' => 'content-order-1',
        ]);
        $subscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'current_period_start' => now(),
            'current_period_end' => now()->addHours(2),
        ]);

        Entitlement::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'content_item',
            'item_id' => $content->id,
            'source_type' => 'subscription',
            'source_id' => $subscription->id,
            'status' => 'active',
            'expires_at' => now()->addHours(2),
        ]);
        Entitlement::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'content_item',
            'item_id' => $content->id,
            'source_type' => 'order',
            'source_id' => $order->id,
            'status' => 'active',
        ]);

        $this->actingAs($user)
            ->getJson('/orders/data/entitlements')
            ->assertOk()
            ->assertJsonCount(1, 'entitlements')
            ->assertJsonPath('entitlements.0.source_type', 'order')
            ->assertJsonPath('entitlements.0.access_kind', 'purchase')
            ->assertJsonPath('entitlements.0.is_temporary_access', false);
    }

    public function test_subscription_product_entitlement_can_use_unified_access_endpoint(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Wedding Template',
            'slug' => 'wedding-template',
            'type' => 'digital',
            'price' => 500,
            'download_link' => 'https://example.com/wedding-template.zip',
        ]);
        $subscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'current_period_start' => now(),
            'current_period_end' => now()->addHours(2),
        ]);
        $entitlement = Entitlement::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'product',
            'item_id' => $product->id,
            'source_type' => 'subscription',
            'source_id' => $subscription->id,
            'status' => 'active',
            'expires_at' => now()->addHours(2),
        ]);

        $this->actingAs($user)
            ->getJson("/orders/data/entitlements/{$entitlement->id}/access")
            ->assertOk()
            ->assertJsonPath('type', 'external')
            ->assertJsonPath('url', 'https://example.com/wedding-template.zip');
    }

    public function test_expired_subscription_product_entitlement_cannot_use_access_endpoint(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Expired Template',
            'slug' => 'expired-template',
            'type' => 'digital',
            'price' => 500,
            'download_link' => 'https://example.com/expired-template.zip',
        ]);
        $subscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'expired',
            'current_period_start' => now()->subHours(3),
            'current_period_end' => now()->subHour(),
        ]);
        $entitlement = Entitlement::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'product',
            'item_id' => $product->id,
            'source_type' => 'subscription',
            'source_id' => $subscription->id,
            'status' => 'active',
            'starts_at' => now()->subHours(3),
            'expires_at' => now()->subHour(),
        ]);

        $this->actingAs($user)
            ->getJson("/orders/data/entitlements/{$entitlement->id}/access")
            ->assertForbidden()
            ->assertJsonPath('message', 'Access ya bidhaa hii haipo active kwa sasa.');
    }

    public function test_orders_library_uses_longest_active_subscription_entitlement_for_same_item(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $otherPlan = SubscriptionPlan::query()->create([
            'merchant_id' => $merchant->id,
            'name' => 'VIP Circle',
            'slug' => 'vip-circle',
            'price' => 500,
            'billing_interval' => 'daily',
            'interval_count' => 1,
            'tier' => 2,
            'status' => 'active',
        ]);
        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Shared Template',
            'slug' => 'shared-template',
            'type' => 'digital',
            'price' => 500,
            'download_link' => 'https://example.com/shared-template.zip',
        ]);
        $shortSubscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'current_period_start' => now(),
            'current_period_end' => now()->addHours(2),
        ]);
        $longSubscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $otherPlan->id,
            'status' => 'active',
            'current_period_start' => now(),
            'current_period_end' => now()->addHours(8),
        ]);

        Entitlement::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'product',
            'item_id' => $product->id,
            'source_type' => 'subscription',
            'source_id' => $shortSubscription->id,
            'status' => 'active',
            'expires_at' => now()->addHours(2),
        ]);
        $longEntitlement = Entitlement::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'product',
            'item_id' => $product->id,
            'source_type' => 'subscription',
            'source_id' => $longSubscription->id,
            'status' => 'active',
            'expires_at' => now()->addHours(8),
        ]);

        $this->actingAs($user)
            ->getJson('/orders/data/entitlements')
            ->assertOk()
            ->assertJsonCount(1, 'entitlements')
            ->assertJsonPath('entitlements.0.id', $longEntitlement->id)
            ->assertJsonPath('entitlements.0.source_id', $longSubscription->id);
    }

    public function test_expired_subscription_plan_order_entitlement_does_not_unlock_gated_post(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $buyer = User::factory()->create(['role' => 'buyer']);
        $post = Post::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Premium Odds',
            'caption' => 'Expired members should not read this.',
            'body' => 'This is a test subscription post!!!!',
            'is_restricted' => true,
        ]);
        $post->promotableSubscriptions()->attach($plan->id);
        $order = Order::query()->create([
            'buyer_id' => $buyer->id,
            'merchant_id' => $merchant->id,
            'purchasable_type' => 'subscription_plan',
            'purchasable_id' => $plan->id,
            'unit_price' => 200,
            'total_paid' => 200,
            'payment_status' => 'resolved_merchant_paid',
            'transaction_ref' => 'legacy-subscription-order',
        ]);

        Entitlement::query()->create([
            'user_id' => $buyer->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'subscription_plan',
            'item_id' => $plan->id,
            'source_type' => 'order',
            'source_id' => $order->id,
            'status' => 'active',
        ]);
        Entitlement::query()->create([
            'user_id' => $buyer->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'subscription_plan',
            'item_id' => $plan->id,
            'source_type' => 'subscription',
            'source_id' => 999,
            'status' => 'active',
            'starts_at' => now()->subHours(3),
            'expires_at' => now()->subHour(),
        ]);

        $request = Request::create('/feed', 'GET');
        $request->setUserResolver(fn () => $buyer);
        $payload = PostResource::make($post->fresh()->load([
            'merchant',
            'media.productImage',
            'linkPreview',
            'promotableProducts',
            'promotableBundles',
            'promotableSubscriptions',
        ]))->resolve($request);

        $this->assertFalse($payload['has_access']);
        $this->assertNull($payload['body']);
        $this->assertNull($payload['caption']);
    }

    public function test_subscription_grants_time_bound_plan_entitlement_for_gated_posts(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $subscription = UserSubscription::query()->create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'current_period_start' => now(),
            'current_period_end' => now()->addHours(2),
        ]);

        app(\App\Services\EntitlementService::class)->grantForSubscription($subscription);

        $this->assertDatabaseHas('entitlements', [
            'user_id' => $user->id,
            'item_type' => 'subscription_plan',
            'item_id' => $plan->id,
            'source_type' => 'subscription',
            'source_id' => $subscription->id,
            'status' => 'active',
        ]);

        $this->assertTrue(app(\App\Services\EntitlementService::class)->hasAccess($user->id, 'subscription_plan', $plan->id));
    }

    public function test_orders_library_hides_legacy_subscription_plan_order_entitlement(): void
    {
        [$user, $merchant, $plan] = $this->subscriptionPlanFixture();
        $buyer = User::factory()->create(['role' => 'buyer']);
        $order = Order::query()->create([
            'buyer_id' => $buyer->id,
            'merchant_id' => $merchant->id,
            'purchasable_type' => 'subscription_plan',
            'purchasable_id' => $plan->id,
            'unit_price' => 200,
            'total_paid' => 200,
            'payment_status' => 'resolved_merchant_paid',
            'transaction_ref' => 'legacy-library-subscription-order',
        ]);

        Entitlement::query()->create([
            'user_id' => $buyer->id,
            'merchant_id' => $merchant->id,
            'item_type' => 'subscription_plan',
            'item_id' => $plan->id,
            'source_type' => 'order',
            'source_id' => $order->id,
            'status' => 'active',
        ]);

        $this->actingAs($buyer)
            ->getJson('/orders/data/entitlements')
            ->assertOk()
            ->assertJsonCount(0, 'entitlements');
    }

    private function subscriptionPlanFixture(): array
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'barida',
            'display_name' => 'Barida',
            'is_default' => true,
            'is_active' => true,
        ]);
        $plan = SubscriptionPlan::query()->create([
            'merchant_id' => $merchant->id,
            'name' => 'Premium Circle',
            'slug' => 'premium-circle',
            'price' => 200,
            'billing_interval' => 'hourly',
            'interval_count' => 2,
            'tier' => 1,
            'status' => 'active',
        ]);

        return [$user, $merchant, $plan];
    }
}
