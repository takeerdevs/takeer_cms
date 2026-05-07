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
use App\Services\LinkPreviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MiniStoreController extends Controller
{
    /**
     * GET /api/merchant/{slug}
     * Returns a specific merchant's PWA Link-in-Bio mini store.
     */
    public function show(Request $request, string $merchantSlug, LinkPreviewService $linkPreviewService): JsonResponse
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
            ->whereHas('postTags.post', function ($post): void {
                $post->whereNull('posts.deleted_at');
            })
            ->with(['attributes', 'images', 'merchant', 'postTags.post'])
            ->withCount([
                'postTags',
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

        $storefrontSetting = $merchant->storefrontSetting;

        return response()->json([
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->display_name,
                'slug' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
                'is_owner' => (bool) ($request->user() && (int) $request->user()->id === (int) $merchant->user_id),
            ],
            'storefront_settings' => $storefrontSetting ? [
                'section_order' => $storefrontSetting->section_order,
                'links' => $this->enrichStorefrontLinks($storefrontSetting->links, $linkPreviewService),
                'custom_sections' => $this->enrichCustomSections($storefrontSetting->custom_sections, $linkPreviewService),
                'hidden_sections' => $storefrontSetting->hidden_sections,
                'featured_product_id' => $storefrontSetting->featured_product_id,
                'item_layouts' => $storefrontSetting->item_layouts ?? [],
                'section_items' => $storefrontSetting->section_items ?? [],
                'hidden_item_keys' => $storefrontSetting->hidden_item_keys ?? [],
                'allow_post_comments' => (bool) ($storefrontSetting->allow_post_comments ?? true),
                'allow_post_reactions' => (bool) ($storefrontSetting->allow_post_reactions ?? true),
                'service_hours' => $storefrontSetting->service_hours ?? [],
                'service_timezone' => $storefrontSetting->service_timezone,
                'service_area_type' => $storefrontSetting->service_area_type,
                'service_locations' => $storefrontSetting->service_locations ?? [],
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

    /**
     * GET /api/merchant/{slug}/catalog
     * Returns public product offers without feed posts.
     */
    public function catalog(Request $request, string $merchantSlug, LinkPreviewService $linkPreviewService): JsonResponse
    {
        $merchant = Merchant::where('username', $merchantSlug)->firstOrFail();

        $products = Product::query()
            ->where('merchant_id', $merchant->id)
            ->whereHas('postTags.post', function ($post): void {
                $post->whereNull('posts.deleted_at');
            })
            ->with(['attributes.brand', 'attributes.model', 'images', 'merchant', 'unitType', 'variants', 'postTags.post:id,views_count'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
                'orders as paid_orders_count' => fn ($orders) => $orders->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid']),
            ])
            ->latest()
            ->paginate(24);

        $productDiscovery = $products->getCollection()->mapWithKeys(function (Product $product) {
            return [$product->id => $this->productDiscoverySignals($product)];
        });

        $storefrontSetting = $merchant->storefrontSetting;

        return response()->json([
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->display_name,
                'slug' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
            ],
            'storefront_settings' => $storefrontSetting ? [
                'links' => $this->enrichStorefrontLinks($storefrontSetting->links, $linkPreviewService),
            ] : null,
            'products' => ProductResource::collection($products)->response()->getData(true),
            'product_discovery' => $productDiscovery,
        ]);
    }

    private function enrichStorefrontLinks(?array $links, LinkPreviewService $linkPreviewService): array
    {
        return collect($links ?: [])
            ->map(function ($link) use ($linkPreviewService) {
                if (! is_array($link)) {
                    return null;
                }

                $url = $this->normalizeStorefrontUrl((string) ($link['url'] ?? ''));
                $preview = $url && ! $this->isSocialUrl($url)
                    ? $linkPreviewService->previewForUrl($url)
                    : null;

                return [
                    ...$link,
                    'url' => $url ?: ($link['url'] ?? ''),
                    'preview' => $preview && $preview->status === 'success' ? [
                        'title' => $preview->title,
                        'description' => $preview->description,
                        'site_name' => $preview->site_name,
                        'image_url' => $preview->image_url ?: $preview->remote_image_url,
                        'favicon_url' => $preview->favicon_url,
                        'final_url' => $preview->final_url ?: $preview->url,
                    ] : null,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function enrichCustomSections(?array $sections, LinkPreviewService $linkPreviewService): array
    {
        return collect($sections ?: [])
            ->map(function ($section) use ($linkPreviewService) {
                if (! is_array($section)) {
                    return null;
                }

                $items = collect($section['items'] ?? $section['links'] ?? [])
                    ->map(function ($item) use ($linkPreviewService) {
                        if (! is_array($item)) {
                            return null;
                        }

                        $kind = $item['kind'] ?? 'link';
                        if ($kind !== 'link') {
                            return $item;
                        }

                        $enriched = $this->enrichStorefrontLinks([$item], $linkPreviewService);

                        return $enriched[0] ?? $item;
                    })
                    ->filter()
                    ->values()
                    ->all();

                return [
                    ...$section,
                    'items' => $items,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function normalizeStorefrontUrl(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }

        if (preg_match('/^(https?:\/\/|mailto:|tel:)/i', $url) !== 1) {
            $url = 'https://' . $url;
        }

        return $url;
    }

    private function isSocialUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host);

        foreach ([
            'instagram.com',
            'tiktok.com',
            'youtube.com',
            'youtu.be',
            'facebook.com',
            'x.com',
            'twitter.com',
            'threads.net',
            'linkedin.com',
            'wa.me',
            'whatsapp.com',
            't.me',
            'telegram.me',
            'snapchat.com',
            'pinterest.com',
            'spotify.com',
            'podcasts.apple.com',
            'soundcloud.com',
        ] as $socialHost) {
            if ($host === $socialHost || str_ends_with($host, '.' . $socialHost)) {
                return true;
            }
        }

        return false;
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
            'item_layouts' => 'nullable|array',
            'section_items' => 'nullable|array',
            'hidden_item_keys' => 'nullable|array',
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
                'item_layouts' => $validated['item_layouts'] ?? null,
                'section_items' => $validated['section_items'] ?? null,
                'hidden_item_keys' => $validated['hidden_item_keys'] ?? null,
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
