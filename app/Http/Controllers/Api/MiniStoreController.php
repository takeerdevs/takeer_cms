<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BundleResource;
use App\Http\Resources\ContentItemResource;
use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\SubscriptionPlanResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\MerchantStorefrontSetting;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MiniStoreController extends Controller
{
    /**
     * GET /api/merchant/{slug}
     * Returns a specific merchant's PWA Link-in-Bio mini store.
     */
    public function show(string $merchantSlug): JsonResponse
    {
        // Find merchant by username slug
        $merchant = Merchant::where('username', $merchantSlug)->firstOrFail();

        // Get their posts (shoppable feed) from THIS profile
        $posts = Post::where('merchant_id', $merchant->id)
            ->with([
                'merchant:id,display_name,username,avatar_url',
                'merchant.storefrontSetting',
                'linkedContentItem',
                'media.productImage',
                'linkedProduct.attributes',
                'linkedProduct.images',
                'linkedProduct.variants',
                'product.attributes',
                'product.images',
                'product.variants',
                'productTags.product.attributes',
                'productTags.product.images',
                'productTags.product.variants',
                'reactions',
                'promotableBundles',
                'promotableSubscriptions',
            ])
            ->latest()
            ->paginate(15);

        $products = Product::where('merchant_id', $merchant->id)
            ->with(['attributes', 'images', 'merchant'])
            ->withCount([
                'orders as paid_orders_count' => fn ($query) => $query->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid']),
            ])
            ->latest()
            ->take(60)
            ->get();

        $contentItems = ContentItem::where('merchant_id', $merchant->id)
            ->where('visibility', 'published')
            ->where('moderation_status', 'approved')
            ->latest()
            ->take(12)
            ->get();

        $bundles = Bundle::where('merchant_id', $merchant->id)
            ->where('status', 'published')
            ->with('items')
            ->latest()
            ->take(12)
            ->get();

        $subscriptionPlans = SubscriptionPlan::where('merchant_id', $merchant->id)
            ->where('status', 'active')
            ->with('items')
            ->orderBy('tier')
            ->take(12)
            ->get();

        $paidOrderBase = \App\Models\Order::query()
            ->where('merchant_id', $merchant->id)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid']);

        $digitalRevenue = (clone $paidOrderBase)
            ->where('purchasable_type', 'product')
            ->whereHas('product', fn ($query) => $query->where('type', 'digital'))
            ->sum('total_paid');

        $memberCount = \App\Models\UserSubscription::query()
            ->where('merchant_id', $merchant->id)
            ->where('status', 'active')
            ->count();

        $monetizationSummary = [
            'paid_offers' => $products->where('type', 'digital')->count() + $contentItems->where('price', '>', 0)->count() + $bundles->count() + $subscriptionPlans->count(),
            'creator_club_tiers' => $subscriptionPlans->count(),
            'active_members' => $memberCount,
            'digital_revenue' => (float) $digitalRevenue,
            'live_events' => $products->where('digital_delivery_type', 'live_event')->count(),
            'custom_commissions' => $products->where('digital_delivery_type', 'custom_delivery')->count(),
        ];
        $productDiscovery = $products->mapWithKeys(function (Product $product) {
            return [$product->id => $this->productDiscoverySignals($product)];
        });

        return response()->json([
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->display_name,
                'slug' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
            ],
            'storefront_settings' => $merchant->storefrontSetting ? [
                'section_order' => $merchant->storefrontSetting->section_order,
                'links' => $merchant->storefrontSetting->links,
                'custom_sections' => $merchant->storefrontSetting->custom_sections,
                'hidden_sections' => $merchant->storefrontSetting->hidden_sections,
                'featured_product_id' => $merchant->storefrontSetting->featured_product_id,
                'allow_post_comments' => (bool) ($merchant->storefrontSetting->allow_post_comments ?? true),
                'allow_post_reactions' => (bool) ($merchant->storefrontSetting->allow_post_reactions ?? true),
                'service_hours' => $merchant->storefrontSetting->service_hours ?? [],
                'service_timezone' => $merchant->storefrontSetting->service_timezone,
                'service_area_type' => $merchant->storefrontSetting->service_area_type,
                'service_locations' => $merchant->storefrontSetting->service_locations ?? [],
            ] : null,
            'products' => ProductResource::collection($products),
            'product_discovery' => $productDiscovery,
            'content_items' => ContentItemResource::collection($contentItems),
            'bundles' => BundleResource::collection($bundles),
            'subscription_plans' => SubscriptionPlanResource::collection($subscriptionPlans),
            'monetization_summary' => $monetizationSummary,
            'posts' => PostResource::collection($posts)->response()->getData(true),
        ]);
    }

    private function productDiscoverySignals(Product $product): array
    {
        $ordersCount = (int) ($product->paid_orders_count ?? 0);
        $viewsCount = (int) ($product->views_count ?? 0);
        $createdAt = $product->created_at;
        $isNew = $createdAt ? $createdAt->greaterThanOrEqualTo(now()->subDays(14)) : false;
        $isPremium = $product->type === 'digital' && in_array($product->digital_delivery_type, [
            'video_stream',
            'audio_stream',
            'gallery_pack',
            'live_event',
            'custom_delivery',
        ], true);
        $isUpcoming = $product->type === 'digital'
            && $product->digital_delivery_type === 'live_event'
            && $product->live_event_starts_at
            && $product->live_event_starts_at->isFuture();
        $seatsRemaining = $product->digital_delivery_type === 'live_event' && $product->live_event_capacity
            ? $product->liveEventSeatsRemaining()
            : null;
        $isLimited = $seatsRemaining !== null && $seatsRemaining > 0 && $seatsRemaining <= 10;

        $score = ($ordersCount * 30)
            + min(80, $viewsCount * 0.5)
            + ($isPremium ? 35 : 0)
            + ($isUpcoming ? 35 : 0)
            + ($isLimited ? 25 : 0)
            + ($isNew ? 20 : 0)
            + ((float) $product->price > 0 ? 8 : 0);

        $badges = [];
        if ($ordersCount > 0 || $viewsCount >= 50) {
            $badges[] = ['label' => 'Popular', 'tone' => 'amber'];
        }
        if ($isNew) {
            $badges[] = ['label' => 'New', 'tone' => 'sky'];
        }
        if ($isUpcoming) {
            $badges[] = ['label' => 'Upcoming', 'tone' => 'violet'];
        }
        if ($isLimited) {
            $badges[] = ['label' => $seatsRemaining . ' seats left', 'tone' => 'rose'];
        }
        if ($isPremium) {
            $badges[] = ['label' => 'Premium', 'tone' => 'emerald'];
        } elseif ($product->type === 'digital') {
            $badges[] = ['label' => 'Digital', 'tone' => 'emerald'];
        }

        return [
            'score' => round($score, 2),
            'badges' => array_slice($badges, 0, 3),
            'orders_count' => $ordersCount,
            'views_count' => $viewsCount,
            'is_new' => $isNew,
            'is_premium' => $isPremium,
            'is_upcoming' => $isUpcoming,
            'is_limited' => $isLimited,
            'seats_remaining' => $seatsRemaining,
        ];
    }

    /**
     * Update storefront settings for a merchant profile.
     */
    public function updateStorefront(Request $request, string $merchantSlug): JsonResponse
    {
        $merchant = Merchant::where('username', $merchantSlug)->firstOrFail();

        if ($request->user()->id !== $merchant->user_id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'section_order' => 'nullable|array',
            'links' => 'nullable|array',
            'custom_sections' => 'nullable|array',
            'hidden_sections' => 'nullable|array',
            'featured_product_id' => 'nullable|integer',
            'service_hours' => 'nullable|array',
            'service_timezone' => 'nullable|string|max:64',
            'service_area_type' => 'nullable|string|in:onsite,remote,hybrid',
            'service_locations' => 'nullable|array',
        ]);

        $settings = MerchantStorefrontSetting::updateOrCreate(
            ['merchant_profile_id' => $merchant->id],
            [
                'section_order' => $validated['section_order'] ?? null,
                'links' => $validated['links'] ?? null,
                'custom_sections' => $validated['custom_sections'] ?? null,
                'hidden_sections' => $validated['hidden_sections'] ?? null,
                'featured_product_id' => $validated['featured_product_id'] ?? null,
                'service_hours' => $validated['service_hours'] ?? null,
                'service_timezone' => $validated['service_timezone'] ?? null,
                'service_area_type' => $validated['service_area_type'] ?? null,
                'service_locations' => $validated['service_locations'] ?? null,
            ]
        );

        return response()->json([
            'message' => 'Storefront settings updated.',
            'storefront_settings' => $settings,
        ]);
    }

    /**
     * GET /api/merchant/{slug}/shipping-zones
     * Returns the active shipping zones for checkout.
     */
    public function shippingZones(Request $request, string $merchantSlug): JsonResponse
    {
        $merchant = Merchant::where('username', $merchantSlug)->firstOrFail();
        $profileId = $request->query('profile_id');

        $query = \App\Models\ShippingZone::where('merchant_id', $merchant->id)
            ->where('is_active', true);

        if ($profileId) {
            $query->where('shipping_profile_id', $profileId);
        }

        $zones = $query->with('location')->latest()->get();

        return response()->json([
            'data' => $zones,
        ]);
    }
}
