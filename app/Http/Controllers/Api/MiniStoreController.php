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
            ->latest()
            ->take(12)
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
            'content_items' => ContentItemResource::collection($contentItems),
            'bundles' => BundleResource::collection($bundles),
            'subscription_plans' => SubscriptionPlanResource::collection($subscriptionPlans),
            'posts' => PostResource::collection($posts)->response()->getData(true),
        ]);
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
