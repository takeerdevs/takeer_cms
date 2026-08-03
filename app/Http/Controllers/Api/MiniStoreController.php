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
use App\Models\ForwarderRoute;
use App\Models\Merchant;
use App\Models\OfferingGroup;
use App\Models\Post;
use App\Models\MerchantStorefrontSetting;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Services\LinkPreviewService;
use App\Services\TrackedLinkService;
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
        $profileOnly = $request->boolean('profile');

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
                'promotableOfferingGroups',
            ])
            ->latest()
            ->paginate(15);

        $storefrontSetting = $merchant->storefrontSetting;
        $businessCategory = $merchant->businessCategory();

        $payload = [
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->display_name,
                'slug' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
                'is_verified' => (bool) $merchant->is_verified,
                'business_category' => $businessCategory['subcategory_label'] ?? $businessCategory['label'] ?? null,
                'followers_count' => $merchant->followers()->count(),
                'is_following' => false,
                'is_owner' => (bool) ($request->user() && (int) $request->user()->id === (int) $merchant->user_id),
            ],
            'storefront_settings' => $storefrontSetting ? [
                'section_order' => $storefrontSetting->section_order,
                'links' => $this->enrichStorefrontLinks($storefrontSetting->links, $linkPreviewService, $merchant->id),
                'custom_sections' => $this->enrichCustomSections($storefrontSetting->custom_sections, $linkPreviewService, $merchant->id),
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
            'commerce_stats' => $this->publicCommerceStats($merchant, $posts->total()),
            'posts' => PostResource::collection($posts)->response()->getData(true),
        ];

        if ($profileOnly) {
            return response()->json($payload);
        }

        $products = Product::where('merchant_id', $merchant->id)
            ->whereHas('postTags.post', function ($post): void {
                $post->whereNull('posts.deleted_at');
            })
            ->with(['attributes', 'images', 'merchant', 'postTags.post'])
            ->withCount([
                'postTags',
                'orders as paid_orders_count' => fn ($query) => $query->whereIn('payment_status', ['payment_confirmed', 'pending_fulfillment', 'release_eligible', 'paid_out']),
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
            ->whereIn('payment_status', ['payment_confirmed', 'pending_fulfillment', 'release_eligible', 'paid_out']);

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
        $offerCounts = $this->publicOfferCounts($merchant);

        return response()->json([
            ...$payload,
            'commerce_stats' => array_merge(['posts' => $posts->total()], $offerCounts),
            'products' => ProductResource::collection($products),
            'product_discovery' => $productDiscovery,
            'content_items' => ContentItemResource::collection($contentItems),
            'bundles' => BundleResource::collection($bundles),
            'subscription_plans' => SubscriptionPlanResource::collection($subscriptionPlans),
            'monetization_summary' => $monetizationSummary,
            'offer_counts' => $offerCounts,
        ]);
    }

    /**
     * GET /api/merchant/{slug}/offers
     * In-app shop: all public sellable types and merchant offer surfaces.
     */
    public function offers(Request $request, string $merchantSlug): JsonResponse
    {
        $merchant = Merchant::where('username', $merchantSlug)->firstOrFail();
        $type = (string) $request->query('type', 'all');
        $search = trim((string) $request->query('q', ''));
        $businessCategory = $merchant->businessCategory();

        $payload = [
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->display_name,
                'slug' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
                'is_verified' => (bool) $merchant->is_verified,
                'business_category' => $businessCategory['subcategory_label'] ?? $businessCategory['label'] ?? null,
                'followers_count' => $merchant->followers()->count(),
                'is_following' => false,
            ],
            'offer_counts' => $this->publicOfferCounts($merchant),
        ];

        if ($type === 'content') {
            $contentItems = ContentItem::query()
                ->where('merchant_id', $merchant->id)
                ->where('visibility', 'published')
                ->where('moderation_status', 'approved')
                ->when($search !== '', fn ($query) => $query->where(function ($inner) use ($search): void {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('excerpt', 'like', "%{$search}%");
                }))
                ->latest()
                ->paginate(24);
            $payload['content_items'] = ContentItemResource::collection($contentItems)->response()->getData(true);

            return response()->json($payload);
        }

        if ($type === 'bundle') {
            $bundles = Bundle::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'published')
                ->with('items')
                ->when($search !== '', fn ($query) => $query->where(function ($inner) use ($search): void {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                }))
                ->latest()
                ->paginate(24);
            $payload['bundles'] = BundleResource::collection($bundles)->response()->getData(true);

            return response()->json($payload);
        }

        if ($type === 'membership') {
            $plans = SubscriptionPlan::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'active')
                ->with('items')
                ->when($search !== '', fn ($query) => $query->where(function ($inner) use ($search): void {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                }))
                ->orderBy('tier')
                ->paginate(24);
            $payload['subscription_plans'] = SubscriptionPlanResource::collection($plans)->response()->getData(true);

            return response()->json($payload);
        }

        if ($type === 'offering_group') {
            $groups = OfferingGroup::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'published')
                ->with(['items.product.images', 'items.childGroup'])
                ->when($search !== '', fn ($query) => $query->where(function ($inner) use ($search): void {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                }))
                ->latest()
                ->paginate(24);
            $payload['offering_groups'] = $this->offeringGroupCollectionPayload($groups);

            return response()->json($payload);
        }

        if ($type === 'freight_route') {
            $routes = $this->publicFreightRouteQuery($merchant)
                ->when($search !== '', fn ($query) => $query->where(function ($inner) use ($search): void {
                    $inner->where('route_uid', 'like', "%{$search}%")
                        ->orWhere('estimate', 'like', "%{$search}%")
                        ->orWhere('customer_instructions', 'like', "%{$search}%");
                }))
                ->latest()
                ->paginate(24);
            $payload['freight_routes'] = $this->freightRouteCollectionPayload($routes);

            return response()->json($payload);
        }

        if (in_array($type, ['physical', 'digital', 'service'], true)) {
            $products = $this->publicCatalogProductQuery($merchant)
                ->where('type', $type)
                ->with(['attributes', 'images', 'merchant', 'unitType'])
                ->when($search !== '', fn ($query) => $query->where(function ($inner) use ($search): void {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                }))
                ->latest()
                ->paginate(24);
            $payload['products'] = ProductResource::collection($products)->response()->getData(true);

            return response()->json($payload);
        }

        $payload['content_items'] = ContentItemResource::collection(
            ContentItem::query()
                ->where('merchant_id', $merchant->id)
                ->where('visibility', 'published')
                ->where('moderation_status', 'approved')
                ->latest()
                ->take(24)
                ->get()
        );
        $payload['bundles'] = BundleResource::collection(
            Bundle::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'published')
                ->with('items')
                ->latest()
                ->take(24)
                ->get()
        );
        $payload['subscription_plans'] = SubscriptionPlanResource::collection(
            SubscriptionPlan::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'active')
                ->with('items')
                ->orderBy('tier')
                ->take(24)
                ->get()
        );
        $payload['offering_groups'] = $this->offeringGroupCollectionPayload(
            OfferingGroup::query()
                ->where('merchant_id', $merchant->id)
                ->where('status', 'published')
                ->with(['items.product.images', 'items.childGroup'])
                ->latest()
                ->take(24)
                ->get()
        );
        $payload['freight_routes'] = $this->freightRouteCollectionPayload(
            $this->publicFreightRouteQuery($merchant)
                ->latest()
                ->take(24)
                ->get()
        );
        $payload['products'] = ProductResource::collection(
            $this->publicCatalogProductQuery($merchant)
                ->with(['attributes', 'images', 'merchant', 'unitType'])
                ->latest()
                ->take(48)
                ->get()
        );

        return response()->json($payload);
    }

    /**
     * GET /api/merchant/{slug}/catalog
     * Returns buyable Product offers (physical, digital, service) that appear on live feed posts.
     * Does not include feed posts, paid ContentItems, bundles, or membership plans — those live on the profile feed and mini-store.
     */
    public function catalog(Request $request, string $merchantSlug, LinkPreviewService $linkPreviewService): JsonResponse
    {
        $merchant = Merchant::where('username', $merchantSlug)->firstOrFail();

        $products = $this->publicCatalogProductQuery($merchant)
            ->with(['attributes.brand', 'attributes.model', 'images', 'merchant', 'unitType', 'variants', 'postTags.post:id,views_count'])
            ->withCount('postTags')
            ->withCount([
                'orders as purchases_count' => fn ($orders) => $orders->whereNotIn('payment_status', ['pending', 'failed']),
                'orders as paid_orders_count' => fn ($orders) => $orders->whereIn('payment_status', ['payment_confirmed', 'pending_fulfillment', 'release_eligible', 'paid_out']),
            ])
            ->latest()
            ->paginate(24);

        $productDiscovery = $products->getCollection()->mapWithKeys(function (Product $product) {
            return [$product->id => $this->productDiscoverySignals($product)];
        });

        $storefrontSetting = $merchant->storefrontSetting;
        $businessCategory = $merchant->businessCategory();
        $catalogStats = $this->publicCatalogStats($merchant);

        return response()->json([
            'merchant' => [
                'id' => $merchant->id,
                'name' => $merchant->display_name,
                'slug' => $merchant->username,
                'avatar_url' => $merchant->avatar_url,
                'bio' => $merchant->bio,
                'is_verified' => (bool) $merchant->is_verified,
                'business_category' => $businessCategory['subcategory_label'] ?? $businessCategory['label'] ?? null,
            ],
            'catalog_stats' => $catalogStats,
            'storefront_settings' => $storefrontSetting ? [
                'links' => $this->enrichStorefrontLinks($storefrontSetting->links, $linkPreviewService, $merchant->id),
            ] : null,
            'products' => ProductResource::collection($products)->response()->getData(true),
            'product_discovery' => $productDiscovery,
        ]);
    }

    /**
     * @return array{posts: int, physical: int, digital: int, services: int, catalog_total: int}
     */
    private function publicCommerceStats(Merchant $merchant, ?int $postsTotal = null): array
    {
        if ($postsTotal === null) {
            $postsTotal = Post::query()
                ->where('merchant_id', $merchant->id)
                ->whereNull('deleted_at')
                ->count();
        }

        return [
            'posts' => $postsTotal,
            ...$this->publicOfferCounts($merchant),
        ];
    }

    /**
     * @return array{physical: int, digital: int, services: int, catalog_total: int, content: int, bundles: int, memberships: int, offerings: int, freight_routes: int, shop_total: int}
     */
    private function publicOfferCounts(Merchant $merchant): array
    {
        $catalogStats = $this->publicCatalogStats($merchant);

        $content = ContentItem::query()
            ->where('merchant_id', $merchant->id)
            ->where('visibility', 'published')
            ->where('moderation_status', 'approved')
            ->count();

        $bundles = Bundle::query()
            ->where('merchant_id', $merchant->id)
            ->where('status', 'published')
            ->count();

        $memberships = SubscriptionPlan::query()
            ->where('merchant_id', $merchant->id)
            ->where('status', 'active')
            ->count();

        $offerings = OfferingGroup::query()
            ->where('merchant_id', $merchant->id)
            ->where('status', 'published')
            ->count();

        $freightRoutes = $this->publicFreightRouteQuery($merchant)->count();

        return [
            ...$catalogStats,
            'content' => $content,
            'bundles' => $bundles,
            'memberships' => $memberships,
            'offerings' => $offerings,
            'freight_routes' => $freightRoutes,
            'shop_total' => $catalogStats['catalog_total'] + $content + $bundles + $memberships + $offerings + $freightRoutes,
        ];
    }

    /**
     * Counts for public catalog: sellable products tagged on live posts, by type.
     *
     * @return array{physical: int, digital: int, services: int, catalog_total: int}
     */
    private function publicCatalogStats(Merchant $merchant): array
    {
        $productBase = $this->publicCatalogProductQuery($merchant);

        $physical = (clone $productBase)->where('type', 'physical')->count();
        $digital = (clone $productBase)->where('type', 'digital')->count();
        $services = (clone $productBase)->where('type', 'service')->count();

        return [
            'physical' => $physical,
            'digital' => $digital,
            'services' => $services,
            'catalog_total' => $physical + $digital + $services,
        ];
    }

    private function publicCatalogProductQuery(Merchant $merchant)
    {
        return Product::query()
            ->where('merchant_id', $merchant->id)
            ->whereHas('postTags.post', function ($post): void {
                $post->whereNull('posts.deleted_at');
            });
    }

    private function publicFreightRouteQuery(Merchant $merchant)
    {
        return ForwarderRoute::query()
            ->where('is_active', true)
            ->whereHas('forwarder', fn ($query) => $query
                ->where('merchant_id', $merchant->id)
                ->where('is_verified', true)
                ->where('verification_status', 'verified'))
            ->with([
                'forwarder:id,merchant_id,name,logo_url',
                'originLocations.country',
                'originLocations.state',
                'originLocations.cityRecord',
                'destinationLocations.country',
                'destinationLocations.state',
                'destinationLocations.cityRecord',
                'transportModes',
            ]);
    }

    private function offeringGroupCollectionPayload($groups): array
    {
        $collection = method_exists($groups, 'getCollection') ? $groups->getCollection() : collect($groups);
        $payload = $collection->map(fn (OfferingGroup $group) => $this->offeringGroupPayload($group))->values()->all();

        if (! $groups instanceof \Illuminate\Pagination\AbstractPaginator) {
            return $payload;
        }

        $pagination = $groups->toArray();

        return [
            ...$pagination,
            'data' => $payload,
        ];
    }

    private function offeringGroupPayload(OfferingGroup $group): array
    {
        $items = $group->relationLoaded('items') ? $group->items : collect();
        $firstImage = $items
            ->map(fn ($item) => $item->product?->image_url ?? $item->childGroup?->cover_image_url)
            ->filter()
            ->first();

        return [
            'id' => $group->id,
            'slug' => $group->slug,
            'title' => $group->title,
            'description' => $group->description,
            'cover_image_url' => $group->cover_image_url ?: $firstImage,
            'group_type' => $group->group_type,
            'template_key' => $group->template_key,
            'base_price' => $group->base_price !== null ? (float) $group->base_price : null,
            'items_count' => $items->count(),
            'href' => '/offerings/' . $group->id,
        ];
    }

    private function freightRouteCollectionPayload($routes): array
    {
        $collection = method_exists($routes, 'getCollection') ? $routes->getCollection() : collect($routes);
        $payload = $collection->map(fn (ForwarderRoute $route) => $this->freightRoutePayload($route))->values()->all();

        if (! $routes instanceof \Illuminate\Pagination\AbstractPaginator) {
            return $payload;
        }

        $pagination = $routes->toArray();

        return [
            ...$pagination,
            'data' => $payload,
        ];
    }

    private function freightRoutePayload(ForwarderRoute $route): array
    {
        $routeRef = $route->route_uid ?: (string) $route->id;
        $origin = $this->routePlaceName($route->originLocations);
        $destination = $this->routePlaceName($route->destinationLocations);

        return [
            'id' => $route->id,
            'route_uid' => $route->route_uid,
            'label' => trim(($origin ?: 'Origin') . ' to ' . ($destination ?: 'Destination')),
            'title' => trim(($origin ?: 'Origin') . ' to ' . ($destination ?: 'Destination')),
            'origin' => $origin,
            'destination' => $destination,
            'origin_locations' => $route->originLocations->map(fn ($location) => $this->routeLocationPayload($location))->values()->all(),
            'destination_locations' => $route->destinationLocations->map(fn ($location) => $this->routeLocationPayload($location))->values()->all(),
            'estimate' => $route->estimate,
            'rates_info' => $route->rates_info,
            'customer_instructions' => $route->customer_instructions,
            'transport_modes' => $route->transportModes->pluck('mode')->filter()->values()->all(),
            'transport_details' => $route->transportModes
                ->mapWithKeys(fn ($mode) => [
                    $mode->mode => [
                        'estimate' => $mode->estimate,
                        'currency' => $mode->currency,
                        'price_amount' => $mode->price_amount !== null ? (float) $mode->price_amount : null,
                        'pricing_model' => $mode->pricing_model,
                    ],
                ])
                ->all(),
            'forwarder_name' => $route->forwarder?->name,
            'logo_url' => $route->forwarder?->logo_url,
            'href' => route('forwarder-routes.show', $routeRef, false),
        ];
    }

    private function routeLocationPayload($location): array
    {
        return [
            'id' => $location?->id,
            'name' => $location?->name,
            'address_line' => $location?->address_line,
            'latitude' => $location?->latitude,
            'longitude' => $location?->longitude,
            'country_id' => $location?->country_id,
            'state_id' => $location?->state_id,
            'city_id' => $location?->city_id,
            'city' => $location?->cityRecord?->name ?: $location?->city_name,
            'state' => $location?->state?->name ?: $location?->state_name,
            'country' => $location?->country?->name ?: $location?->country_name,
            'contact_phone' => $location?->contact_phone,
            'required_fields' => $location?->required_fields ?: [],
        ];
    }

    private function routePlaceName($locations): string
    {
        $countryNames = $locations->map(fn ($location) => $location->country?->name)->filter()->unique()->values();
        if ($countryNames->count() === 1) {
            return $countryNames->first();
        }
        if ($countryNames->count() > 1) {
            return $countryNames->join(', ');
        }

        $stateNames = $locations->map(fn ($location) => $location->state?->name)->filter()->unique()->values();
        if ($stateNames->count() > 0) {
            return $stateNames->join(', ');
        }

        return $locations->map(fn ($location) => $location->name)->filter()->unique()->join(', ');
    }

    private function enrichStorefrontLinks(?array $links, LinkPreviewService $linkPreviewService, ?int $merchantId = null): array
    {
        $trackedLinks = app(TrackedLinkService::class);

        return collect($links ?: [])
            ->map(function ($link) use ($linkPreviewService, $trackedLinks, $merchantId) {
                if (! is_array($link)) {
                    return null;
                }

                $url = $this->normalizeStorefrontUrl((string) ($link['url'] ?? ''));
                $preview = $url && ! $this->isSocialUrl($url)
                    ? $linkPreviewService->previewForUrl($url)
                    : null;
                $trackedLink = $trackedLinks->trackedLinkFor($url, [
                    'merchant_id' => $merchantId,
                    'link_type' => $this->isSocialUrl($url) ? 'social_profile' : 'storefront_link',
                    'source_surface' => 'storefront',
                    'entity_type' => 'merchant',
                    'entity_id' => $merchantId,
                    'label' => $link['title'] ?? $link['label'] ?? null,
                    'metadata' => [
                        'original_link' => $link,
                    ],
                ]);

                return [
                    ...$link,
                    'url' => $url ?: ($link['url'] ?? ''),
                    'tracked_url' => $trackedLink?->isActive() ? route('tracked-links.follow', $trackedLink->code, false) : null,
                    'tracked_link_status' => $trackedLink?->status,
                    'link_unavailable' => $trackedLink ? ! $trackedLink->isActive() : false,
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

    private function enrichCustomSections(?array $sections, LinkPreviewService $linkPreviewService, ?int $merchantId = null): array
    {
        return collect($sections ?: [])
            ->map(function ($section) use ($linkPreviewService, $merchantId) {
                if (! is_array($section)) {
                    return null;
                }

                $items = collect($section['items'] ?? $section['links'] ?? [])
                    ->map(function ($item) use ($linkPreviewService, $merchantId) {
                        if (! is_array($item)) {
                            return null;
                        }

                        $kind = $item['kind'] ?? 'link';
                        if ($kind !== 'link') {
                            return $item;
                        }

                        $enriched = $this->enrichStorefrontLinks([$item], $linkPreviewService, $merchantId);

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
        $profile = null;

        if ($profileId) {
            $profile = \App\Models\ShippingProfile::query()
                ->where('merchant_id', $merchant->id)
                ->find($profileId);
        }

        if (!$profile) {
            $profile = \App\Models\ShippingProfile::query()
                ->where('merchant_id', $merchant->id)
                ->where('is_default', true)
                ->first();
        }

        $query = \App\Models\ShippingZone::where('merchant_id', $merchant->id)
            ->where('is_active', true);

        if ($profile) {
            $query->where('shipping_profile_id', $profile->id);
        }

        $zones = $query->with(['location', 'hotspots', 'destinationCountryRecord', 'destinationStateRecord', 'destinationCityRecord'])->latest()->get();

        return response()->json([
            'profile' => $profile?->only(['id', 'name', 'is_default', 'outside_area_policy', 'in_city_enabled', 'intercity_enabled', 'international_enabled']),
            'data' => $zones,
        ]);
    }
}
