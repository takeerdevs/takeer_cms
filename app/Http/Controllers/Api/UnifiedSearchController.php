<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Services\DiscoveryRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UnifiedSearchController extends Controller
{
    public function posts(Request $request, DiscoveryRankingService $ranking): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'nullable|string|max:220',
            'type' => 'nullable|string|in:all,physical,digital,service,creator,custom',
            'surface' => 'nullable|string|in:all,products',
            'category_id' => 'nullable|integer|exists:product_categories,id',
            'sub_category_id' => 'nullable|integer|exists:product_categories,id',
            'service_category_id' => 'nullable|integer|exists:service_categories,id',
            'service_subcategory_id' => 'nullable|integer|exists:service_categories,id',
            'service_category' => 'nullable|string|max:120',
            'service_subcategory' => 'nullable|string|max:120',
            'country_id' => 'nullable|integer|exists:countries,id',
            'location' => 'nullable|string|max:120',
            'lat' => 'nullable|numeric|between:-90,90',
            'lng' => 'nullable|numeric|between:-180,180',
            'radius_km' => 'nullable|numeric|min:1|max:300',
            'per_page' => 'nullable|integer|min:1|max:20',
            'page' => 'nullable|integer|min:1',
        ]);

        $q = trim((string) ($validated['q'] ?? ''));
        $filters = [
            'type' => (string) ($validated['type'] ?? 'all'),
            'surface' => (string) ($validated['surface'] ?? 'all'),
            'category_id' => $validated['category_id'] ?? null,
            'sub_category_id' => $validated['sub_category_id'] ?? null,
            'service_category_id' => $validated['service_category_id'] ?? null,
            'service_subcategory_id' => $validated['service_subcategory_id'] ?? null,
            'service_category' => trim((string) ($validated['service_category'] ?? '')),
            'service_subcategory' => trim((string) ($validated['service_subcategory'] ?? '')),
            'country_id' => $validated['country_id'] ?? null,
            'location' => trim((string) ($validated['location'] ?? '')),
            'lat' => $validated['lat'] ?? null,
            'lng' => $validated['lng'] ?? null,
            'radius_km' => $validated['radius_km'] ?? null,
        ];
        $perPage = (int) ($validated['per_page'] ?? 10);
        $page = (int) ($validated['page'] ?? 1);
        $tokens = $this->tokenize($q);

        $productOnly = $filters['surface'] === 'products';
        $postScores = [];

        if (! $productOnly && $tokens !== []) {
            $this->addWeightedIds($postScores, $this->directPostMatches($tokens), 120);
        }

        $productIds = $this->matchingProductIds($tokens, $filters);
        if (! $productOnly && $productIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, $this->postIdsForProducts($productIds), 200);
        }

        $contentIds = ! $productOnly && $tokens !== [] && in_array($filters['type'], ['all', 'digital', 'creator'], true)
            ? $this->matchingContentItemIds($tokens)
            : collect();
        if ($contentIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, Post::query()->whereIn('content_item_id', $contentIds)->pluck('id'), 170);
        }

        $bundleIds = ! $productOnly && $tokens !== [] && in_array($filters['type'], ['all', 'digital', 'creator'], true)
            ? $this->matchingBundleIds($tokens)
            : collect();
        if ($bundleIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, $this->postIdsForPromotables($bundleIds, Bundle::class), 150);
        }

        $planIds = ! $productOnly && $tokens !== [] && in_array($filters['type'], ['all', 'creator'], true)
            ? $this->matchingSubscriptionPlanIds($tokens)
            : collect();
        if ($planIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, $this->postIdsForPromotables($planIds, SubscriptionPlan::class), 140);
        }

        $postResults = $productOnly ? collect() : $this->hydratePostResults($postScores, $request, $ranking);
        $productResults = $this->hydrateProductResults($productIds, $tokens, $q, $request, $ranking, $filters);
        $merchantResults = ($productOnly || $tokens === []) ? collect() : $this->hydrateMerchantResults($tokens, $q, $filters);

        $allResults = collect()->concat($productResults)->concat($postResults)->concat($merchantResults)
            ->sortByDesc('sort_score')
            ->values();

        $total = $allResults->count();
        $lastPage = max((int) ceil($total / $perPage), 1);
        $safePage = min($page, $lastPage);
        $offset = ($safePage - 1) * $perPage;
        $pageResults = $allResults->slice($offset, $perPage)->values();

        return response()->json([
            'data' => $pageResults,
            'meta' => [
                'query' => $q,
                'filters' => $filters,
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $safePage,
                'last_page' => $lastPage,
            ],
        ]);
    }

    private function hydratePostResults(array $scores, Request $request, DiscoveryRankingService $ranking): Collection
    {
        if (empty($scores)) {
            return collect();
        }

        arsort($scores);
        $sortedIds = array_keys($scores);

        $posts = Post::query()
            ->with([
                'merchant:id,display_name,username,avatar_url,is_verified',
                'merchant.storefrontSetting',
                'linkedContentItem',
                'linkedProduct.attributes',
                'linkedProduct.images',
                'linkedProduct.variants',
                'product.attributes',
                'product.images',
                'product.variants',
                'media.productImage',
                'productTags.product.attributes',
                'productTags.product.images',
                'productTags.product.variants',
                'reactions',
                'promotableProducts',
                'promotableBundles',
                'promotableSubscriptions',
            ])
            ->whereIn('id', $sortedIds)
            ->get()
            ->sortBy(fn(Post $post) => array_search($post->id, $sortedIds, true))
            ->values();

        $resolved = PostResource::collection($posts)->resolve($request);

        return collect($resolved)->map(function (array $payload) use ($scores, $posts, $ranking) {
            $score = (int) ($scores[(int) ($payload['id'] ?? 0)] ?? 0);
            $post = $posts->firstWhere('id', (int) ($payload['id'] ?? 0));

            return [
                'type' => 'post',
                'id' => (int) ($payload['id'] ?? 0),
                'score' => $score,
                'sort_score' => $score + 30 + ($post ? $ranking->postSearchBoost($post) : 0),
                'payload' => $payload,
            ];
        });
    }

    private function hydrateProductResults(Collection $ids, array $tokens, string $rawQuery, Request $request, DiscoveryRankingService $ranking, array $filters): Collection
    {
        if ($ids->isEmpty()) {
            return collect();
        }

        $queryLower = mb_strtolower(trim($rawQuery));

        $products = Product::query()
            ->whereIn('id', $ids)
            ->whereHas('merchant', function ($merchant): void {
                $merchant->where('is_active', true)
                    ->where('is_suspended', false);
            })
            ->with([
                'merchant:id,display_name,username,avatar_url,is_verified,kyc_status,successful_sales,unsuccessful_sales,user_id,country_id',
                'merchant.locations:id,merchant_id,name,address,city,region,latitude,longitude,is_primary,allow_self_pickup',
                'attributes',
                'images',
                'unitType',
                'packageContentUnitType',
                'returnPolicy',
                'faqs',
                'variants',
                'categoryAttributeValues.categoryAttribute',
            ])
            ->limit(40)
            ->get();

        $resolved = ProductResource::collection($products)->resolve($request);

        return collect($resolved)->map(function (array $payload) use ($products, $queryLower, $tokens, $ranking, $filters) {
            $product = $products->firstWhere('id', (int) ($payload['id'] ?? 0));
            if (! $product) {
                return null;
            }

            if (($filters['lat'] ?? null) !== null && ($filters['lng'] ?? null) !== null && ! $ranking->isInsideSearchRadius($product, $filters)) {
                return null;
            }

            $title = mb_strtolower((string) $product->title);
            $score = 95 + $ranking->productSearchBoost($product) + $ranking->locationBoost($product, $filters);

            if ($queryLower !== '' && $title === $queryLower) {
                $score += 180;
            }

            foreach ($tokens as $token) {
                if (str_contains($title, $token)) {
                    $score += 55;
                }
            }

            return [
                'type' => 'product',
                'id' => (int) $product->id,
                'score' => $score,
                'sort_score' => $score + 20,
                'payload' => array_merge($payload, [
                    'discovery_location' => $ranking->discoveryLocation($product, $filters),
                ]),
            ];
        })->filter()->values();
    }

    private function hydrateMerchantResults(array $tokens, string $rawQuery, array $filters): Collection
    {
        if (empty($tokens)) {
            return collect();
        }

        $operator = $this->textMatchOperator();
        $queryLower = mb_strtolower(trim($rawQuery));

        $merchants = Merchant::query()
            ->where('is_active', true)
            ->where('is_suspended', false)
            ->where('is_verified', true)
            ->when($filters['country_id'] ?? null, fn ($query, $countryId) => $query->where('country_id', $countryId))
            ->where(function ($query) use ($tokens, $operator) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('display_name', $operator, $like)
                        ->orWhere('username', $operator, $like)
                        ->orWhere('bio', $operator, $like)
                        ->orWhere('type', $operator, $like)
                        ->orWhereHas('locations', function ($loc) use ($like, $operator) {
                            $loc->where('name', $operator, $like)
                                ->orWhere('address', $operator, $like)
                                ->orWhere('city', $operator, $like)
                                ->orWhere('region', $operator, $like);
                        });
                }
            })
            ->when($filters['location'] ?? '', function ($query, $location) use ($operator) {
                $like = '%' . trim((string) $location) . '%';
                $query->whereHas('locations', function ($loc) use ($like, $operator) {
                    $loc->where('name', $operator, $like)
                        ->orWhere('address', $operator, $like)
                        ->orWhere('city', $operator, $like)
                        ->orWhere('region', $operator, $like);
                });
            })
            ->with(['locations:id,merchant_id,name,address,city,region,is_primary'])
            ->withCount(['posts', 'products', 'locations'])
            ->limit(20)
            ->get();

        return $merchants->map(function (Merchant $merchant) use ($queryLower, $tokens) {
            $name = mb_strtolower((string) $merchant->display_name);
            $username = mb_strtolower((string) $merchant->username);
            $score = 80;

            if ($queryLower !== '' && ($name === $queryLower || $username === $queryLower || '@' . $username === $queryLower)) {
                $score += 220;
            }

            foreach ($tokens as $token) {
                if (str_contains($name, $token) || str_contains($username, $token)) {
                    $score += 45;
                }
            }

            $primaryLocation = $merchant->locations->firstWhere('is_primary', true) ?: $merchant->locations->first();
            $locationExtraCount = max(0, ((int) $merchant->locations_count) - ($primaryLocation ? 1 : 0));

            return [
                'type' => 'merchant',
                'id' => (int) $merchant->id,
                'score' => $score,
                'sort_score' => $score,
                'payload' => [
                    'id' => (int) $merchant->id,
                    'name' => $merchant->display_name,
                    'username' => $merchant->username,
                    'avatar_url' => $merchant->avatar_url,
                    'bio' => $merchant->bio,
                    'type' => $merchant->type,
                    'is_verified' => (bool) $merchant->is_verified,
                    'successful_sales' => (int) ($merchant->successful_sales ?? 0),
                    'unsuccessful_sales' => (int) ($merchant->unsuccessful_sales ?? 0),
                    'posts_count' => (int) ($merchant->posts_count ?? 0),
                    'products_count' => (int) ($merchant->products_count ?? 0),
                    'locations_count' => (int) ($merchant->locations_count ?? 0),
                    'location_extra_count' => $locationExtraCount,
                    'primary_location' => $primaryLocation ? [
                        'name' => $primaryLocation->name,
                        'address' => $primaryLocation->address,
                        'city' => $primaryLocation->city,
                        'region' => $primaryLocation->region,
                        'type' => $primaryLocation->type,
                    ] : null,
                    'store_url' => '/m/' . $merchant->username,
                ],
            ];
        })->values();
    }

    private function tokenize(string $q): array
    {
        $normalized = mb_strtolower($q);
        $parts = preg_split('/[^\p{L}\p{N}]+/u', $normalized) ?: [];

        return collect($parts)
            ->map(fn(string $token) => trim($token))
            ->filter(fn(string $token) => mb_strlen($token) >= 2)
            ->unique()
            ->values()
            ->all();
    }

    private function directPostMatches(array $tokens): Collection
    {
        $operator = $this->textMatchOperator();
        return Post::query()
            ->where(function ($query) use ($tokens, $operator) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('title', $operator, $like)
                        ->orWhere('caption', $operator, $like)
                        ->orWhere('excerpt', $operator, $like)
                        ->orWhere('body', $operator, $like);
                }
            })
            ->limit(250)
            ->pluck('id');
    }

    private function matchingProductIds(array $tokens, array $filters): Collection
    {
        $operator = $this->textMatchOperator();
        $digitalIntent = $this->digitalDiscoveryIntent($tokens);

        return Product::query()
            ->whereHas('merchant', function ($merchant) use ($filters): void {
                $merchant->where('is_active', true)
                    ->where('is_suspended', false)
                    ->when($filters['country_id'] ?? null, fn ($query, $countryId) => $query->where('country_id', $countryId));
            })
            ->when(($filters['type'] ?? 'all') !== 'all', function ($query) use ($filters): void {
                $type = (string) $filters['type'];
                if ($type === 'creator') {
                    $query->where('type', 'digital')
                        ->whereIn('digital_delivery_type', ['video_stream', 'audio_stream', 'gallery_pack', 'live_event', 'custom_delivery']);
                    return;
                }
                if ($type === 'custom') {
                    $query->where('type', 'digital')
                        ->where('digital_delivery_type', 'custom_delivery');
                    return;
                }
                $query->where('type', $type);
            })
            ->when($filters['category_id'] ?? null, function ($query, $categoryId): void {
                $query->whereHas('attributes', fn ($attr) => $attr->where('category_id', $categoryId));
            })
            ->when($filters['sub_category_id'] ?? null, function ($query, $subCategoryId): void {
                $query->whereHas('attributes', fn ($attr) => $attr->where('sub_category_id', $subCategoryId));
            })
            ->when(($filters['service_category'] ?? '') !== '', function ($query) use ($filters): void {
                $query->where('service_category', $filters['service_category']);
            })
            ->when(($filters['service_subcategory'] ?? '') !== '', function ($query) use ($filters): void {
                $query->where('service_subcategory', $filters['service_subcategory']);
            })
            ->when($filters['service_category_id'] ?? null, function ($query, $categoryId): void {
                $query->where('service_category_id', $categoryId);
            })
            ->when($filters['service_subcategory_id'] ?? null, function ($query, $subcategoryId): void {
                $query->where('service_subcategory_id', $subcategoryId);
            })
            ->when(trim((string) ($filters['location'] ?? '')) !== '', function ($query) use ($filters, $operator): void {
                $like = '%' . trim((string) $filters['location']) . '%';
                $query->where(function ($locationQuery) use ($like, $operator): void {
                    $locationQuery->where('type', '!=', 'physical')
                        ->orWhereHas('merchant.locations', function ($loc) use ($like, $operator): void {
                            $loc->where('name', $operator, $like)
                                ->orWhere('address', $operator, $like)
                                ->orWhere('city', $operator, $like)
                                ->orWhere('region', $operator, $like);
                        });
                });
            })
            ->when($tokens !== [] || $digitalIntent['content_types'] !== [] || $digitalIntent['delivery_types'] !== [], function ($query) use ($tokens, $operator, $digitalIntent): void {
                $query->where(function ($query) use ($tokens, $operator, $digitalIntent) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('title', $operator, $like)
                        ->orWhere('digital_content_type', $operator, $like)
                        ->orWhere('digital_delivery_type', $operator, $like)
                        ->orWhere('digital_usage_license', $operator, $like)
                        ->orWhere('digital_access_instructions', $operator, $like)
                        ->orWhere('service_category', $operator, $like)
                        ->orWhere('service_subcategory', $operator, $like)
                        ->orWhere('service_price_display', $operator, $like)
                        ->orWhereHas('attributes', function ($attr) use ($like, $operator) {
                            $attr->where('category', $operator, $like)
                                ->orWhere('sub_category', $operator, $like)
                                ->orWhere('material', $operator, $like)
                                ->orWhere('style', $operator, $like)
                                ->orWhere('detected_gender', $operator, $like)
                                ->orWhere('suggested_description', $operator, $like);
                        })
                        ->orWhereHas('variants', function ($variant) use ($like, $operator) {
                            $variant->where('is_active', true)
                                ->where(function ($v) use ($like, $operator) {
                                    $v->where('name', $operator, $like)
                                        ->orWhere('sku', $operator, $like);
                                });
                        })
                        ->orWhereHas('categoryAttributeValues', function ($value) use ($like, $operator) {
                            $value->where('value_text', $operator, $like)
                                ->orWhere('value_number', $operator, $like)
                                ->orWhere('value_json', $operator, $like)
                                ->orWhereHas('categoryAttribute', function ($ca) use ($like, $operator) {
                                    $ca->where('key', $operator, $like)
                                        ->orWhere('label', $operator, $like);
                                });
                        });
                }

                if ($digitalIntent['content_types'] !== []) {
                    $query->orWhere(function ($digital) use ($digitalIntent): void {
                        $digital->where('type', 'digital')
                            ->whereIn('digital_content_type', $digitalIntent['content_types']);
                    });
                }

                if ($digitalIntent['delivery_types'] !== []) {
                    $query->orWhere(function ($digital) use ($digitalIntent): void {
                        $digital->where('type', 'digital')
                            ->whereIn('digital_delivery_type', $digitalIntent['delivery_types']);
                    });
                }
                });
            })
            ->orderByDesc('views_count')
            ->latest()
            ->limit(400)
            ->pluck('id');
    }

    private function matchingContentItemIds(array $tokens): Collection
    {
        $operator = $this->textMatchOperator();
        return ContentItem::query()
            ->where('visibility', 'published')
            ->where('moderation_status', 'approved')
            ->where(function ($query) use ($tokens, $operator) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('title', $operator, $like)
                        ->orWhere('excerpt', $operator, $like)
                        ->orWhere('body', $operator, $like);
                }
            })
            ->limit(200)
            ->pluck('id');
    }

    private function matchingBundleIds(array $tokens): Collection
    {
        $operator = $this->textMatchOperator();
        return Bundle::query()
            ->where('status', 'published')
            ->where(function ($query) use ($tokens, $operator) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('title', $operator, $like)
                        ->orWhere('description', $operator, $like);
                }
            })
            ->limit(200)
            ->pluck('id');
    }

    private function matchingSubscriptionPlanIds(array $tokens): Collection
    {
        $operator = $this->textMatchOperator();
        return SubscriptionPlan::query()
            ->where('status', 'active')
            ->where(function ($query) use ($tokens, $operator) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('name', $operator, $like)
                        ->orWhere('description', $operator, $like);
                }
            })
            ->limit(200)
            ->pluck('id');
    }

    private function postIdsForProducts(Collection $productIds): Collection
    {
        $tagged = DB::table('post_product_tags')
            ->whereIn('product_id', $productIds)
            ->pluck('post_id');

        $linked = collect();
        if (Schema::hasColumn('posts', 'product_id')) {
            $linked = Post::query()
                ->whereIn('product_id', $productIds)
                ->pluck('id');
        }

        return $tagged->merge($linked)->unique()->values();
    }

    private function postIdsForPromotables(Collection $ids, string $promotableType): Collection
    {
        return DB::table('post_promotables')
            ->where('promotable_type', $promotableType)
            ->whereIn('promotable_id', $ids)
            ->pluck('post_id')
            ->unique()
            ->values();
    }

    private function addWeightedIds(array &$scores, Collection $ids, int $weight): void
    {
        foreach ($ids as $id) {
            $key = (int) $id;
            $scores[$key] = ($scores[$key] ?? 0) + $weight;
        }
    }

    private function digitalDiscoveryIntent(array $tokens): array
    {
        $contentTypes = [];
        $deliveryTypes = [];

        $matchesAny = fn (array $needles): bool => collect($tokens)
            ->contains(fn (string $token) => in_array($token, $needles, true));

        if ($matchesAny(['download', 'downloads', 'asset', 'assets', 'file', 'files', 'template', 'templates'])) {
            $contentTypes = array_merge($contentTypes, ['file', 'ebook', 'template_asset', 'creative_asset', 'document', 'software']);
            $deliveryTypes[] = 'file';
        }

        if ($matchesAny(['ebook', 'ebooks', 'book', 'books'])) {
            $contentTypes[] = 'ebook';
            $deliveryTypes[] = 'file';
        }

        if ($matchesAny(['document', 'documents', 'doc', 'docs', 'pdf'])) {
            $contentTypes[] = 'document';
            $deliveryTypes[] = 'file';
        }

        if ($matchesAny(['software', 'code', 'script', 'app'])) {
            $contentTypes[] = 'software';
            $deliveryTypes[] = 'file';
        }

        if ($matchesAny(['premium', 'video', 'videos', 'audio', 'gallery', 'media'])) {
            $deliveryTypes = array_merge($deliveryTypes, ['video_stream', 'audio_stream', 'gallery_pack']);
        }

        if ($matchesAny(['event', 'events', 'webinar', 'workshop', 'live'])) {
            $deliveryTypes[] = 'live_event';
        }

        return [
            'content_types' => array_values(array_unique($contentTypes)),
            'delivery_types' => array_values(array_unique($deliveryTypes)),
        ];
    }

    private function textMatchOperator(): string
    {
        return DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }
}
