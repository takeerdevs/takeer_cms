<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UnifiedSearchController extends Controller
{
    public function posts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => 'required|string|min:2|max:220',
            'per_page' => 'nullable|integer|min:1|max:20',
            'page' => 'nullable|integer|min:1',
        ]);

        $q = trim((string) $validated['q']);
        $perPage = (int) ($validated['per_page'] ?? 10);
        $page = (int) ($validated['page'] ?? 1);
        $tokens = $this->tokenize($q);

        $postScores = [];
        $this->addWeightedIds($postScores, $this->directPostMatches($tokens), 120);

        $productIds = $this->matchingProductIds($tokens);
        if ($productIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, $this->postIdsForProducts($productIds), 200);
        }

        $contentIds = $this->matchingContentItemIds($tokens);
        if ($contentIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, Post::query()->whereIn('content_item_id', $contentIds)->pluck('id'), 170);
        }

        $bundleIds = $this->matchingBundleIds($tokens);
        if ($bundleIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, $this->postIdsForPromotables($bundleIds, Bundle::class), 150);
        }

        $planIds = $this->matchingSubscriptionPlanIds($tokens);
        if ($planIds->isNotEmpty()) {
            $this->addWeightedIds($postScores, $this->postIdsForPromotables($planIds, SubscriptionPlan::class), 140);
        }

        $postResults = $this->hydratePostResults($postScores, $request);
        $merchantResults = $this->hydrateMerchantResults($tokens, $q);

        $allResults = collect()->concat($postResults)->concat($merchantResults)
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
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $safePage,
                'last_page' => $lastPage,
            ],
        ]);
    }

    private function hydratePostResults(array $scores, Request $request): Collection
    {
        if (empty($scores)) {
            return collect();
        }

        arsort($scores);
        $sortedIds = array_keys($scores);

        $posts = Post::query()
            ->with([
                'merchant:id,display_name,username,avatar_url',
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
                'promotableBundles',
                'promotableSubscriptions',
            ])
            ->whereIn('id', $sortedIds)
            ->get()
            ->sortBy(fn(Post $post) => array_search($post->id, $sortedIds, true))
            ->values();

        $resolved = PostResource::collection($posts)->resolve($request);

        return collect($resolved)->map(function (array $payload) use ($scores) {
            $score = (int) ($scores[(int) ($payload['id'] ?? 0)] ?? 0);

            return [
                'type' => 'post',
                'id' => (int) ($payload['id'] ?? 0),
                'score' => $score,
                'sort_score' => $score + 30,
                'payload' => $payload,
            ];
        });
    }

    private function hydrateMerchantResults(array $tokens, string $rawQuery): Collection
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

    private function matchingProductIds(array $tokens): Collection
    {
        $operator = $this->textMatchOperator();
        return Product::query()
            ->where(function ($query) use ($tokens, $operator) {
                foreach ($tokens as $token) {
                    $like = "%{$token}%";
                    $query->orWhere('title', $operator, $like)
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
                                ->orWhereHas('categoryAttribute', function ($ca) use ($like, $operator) {
                                    $ca->where('key', $operator, $like)
                                        ->orWhere('label', $operator, $like);
                                });
                        });
                }
            })
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

    private function textMatchOperator(): string
    {
        return DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
    }
}
