<?php

namespace App\Http\Resources;

use App\Services\EntitlementService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $directProduct = $this->relationLoaded('linkedProduct') ? $this->linkedProduct : null;
        $primaryProduct = $this->relationLoaded('product') ? $this->product : null;
        $tagProduct = $this->relationLoaded('productTags')
            ? $this->productTags->first()?->product
            : null;

        $resolvedProduct = $directProduct ?? $primaryProduct;
        if (!$resolvedProduct || (isset($resolvedProduct->price) && (float) $resolvedProduct->price <= 0)) {
            $resolvedProduct = $tagProduct ?? $resolvedProduct;
        }

        $this->loadMissing('media.productImage');
        $mediaItems = $this->media ?? collect();
        $fallbackMedia = $mediaItems->first();
        $user = $request->user();
        $commentsEnabled = $this->effectiveCommentsEnabled();
        $reactionsEnabled = $this->effectiveReactionsEnabled();
        $isDeleted = method_exists($this->resource, 'trashed') ? (bool) $this->resource->trashed() : false;

        // ── Access Logic ─────────────────────────────────────────────────────
        $attachedPromotables = $this->promotables ?? collect();
        $hasPromotableGate = $attachedPromotables->isNotEmpty();
        $hasSingleUnlockPrice = $this->restricted_price !== null;
        $isRestricted = (bool) ($this->is_restricted ?? false) || $hasPromotableGate || $hasSingleUnlockPrice;
        $hasAccess = true;
        $isAdminViewer = (bool) ($user?->is_admin ?? false);

        if ($isRestricted && !$isAdminViewer) {
            $hasAccess = false;
            if ($user) {
                // 1. Check access for the attached promotions (Bundles/Plans)
                if ($hasPromotableGate) {
                    $typeMap = [
                        \App\Models\Product::class => 'product',
                        \App\Models\Bundle::class => 'bundle',
                        \App\Models\SubscriptionPlan::class => 'subscription_plan',
                    ];
                    
                    foreach ($attachedPromotables as $promo) {
                        $shortType = $typeMap[get_class($promo)] ?? null;
                        if ($shortType) {
                            if (app(EntitlementService::class)->hasAccess((int) $user->id, $shortType, (int) $promo->id)) {
                                $hasAccess = true;
                                break;
                            }
                        }
                    }
                }

                // 2. If still no access, check one-time unlock entitlement (supports price 0 simulation too)
                if (!$hasAccess && $hasSingleUnlockPrice) {
                    $hasAccess = app(EntitlementService::class)->hasAccess((int) $user->id, 'post', (int) $this->id);
                }
            }
        }

        $canInteractWithRestricted = !$isRestricted || $hasAccess;
        $reactionSummary = $canInteractWithRestricted ? $this->reactionSummary() : [];
        $myReaction = ($canInteractWithRestricted && $user) ? $this->myReactionForUser((int) $user->id) : null;

        // ── Masking ──────────────────────────────────────────────────────────
        $displayCaption = $hasAccess ? $this->caption : null;
        $displayBody = $hasAccess ? $this->body : null;
        $displayTitle = $this->title ?: $resolvedProduct?->title;
        $displayExcerpt = $this->excerpt
            ?: (is_string($resolvedProduct?->description ?? null) ? trim((string) $resolvedProduct->description) : null);
        $isLongFormPost = !empty($displayBody) || !empty($displayExcerpt);

        $rawHotspots = $this->hotspots;
        if (!$rawHotspots || !is_array($rawHotspots)) {
            $rawHotspots = $mediaItems->mapWithKeys(function ($item, $index) {
                $spots = $item?->productImage?->hotspots;
                return [$index => is_array($spots) ? $spots : []];
            })->toArray();
        }

        $resolvedHotspots = (!$hasAccess && $isRestricted)
            ? []
            : collect($rawHotspots)->map(function ($spots) use ($request) {
                return collect($spots)->map(function ($spot) use ($request) {
                    if (isset($spot['type']) && $spot['type'] === 'product' && isset($spot['data'])) {
                        $product = \App\Models\Product::with(['images', 'attributes', 'merchant'])->find($spot['data']);
                        if ($product) {
                            $spot['product'] = ProductResource::make($product)->resolve($request);
                        }
                    }

                    return $spot;
                })->values()->toArray();
            })->toArray();

        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'permalink' => url('/p/' . ($this->public_id ?: $this->id)),
            'merchant_id' => $this->merchant_id,
            'caption' => $displayCaption,
            'title' => $displayTitle,
            'excerpt' => $displayExcerpt,
            'body' => $displayBody,
            'bg_style' => $this->bg_style,
            'post_type' => $isLongFormPost ? 'long' : 'short',
            'is_restricted' => $isRestricted,
            'has_access' => $hasAccess,
            'restricted_price' => $this->restricted_price,
            
            'promotables' => $this->when($this->promotables->isNotEmpty(), function() {
                return $this->promotables->map(function ($promotable) {
                    $typeMap = [
                        \App\Models\Product::class => 'product',
                        \App\Models\Bundle::class => 'bundle',
                        \App\Models\SubscriptionPlan::class => 'subscription_plan',
                    ];
                    $resolvedType = $typeMap[get_class($promotable)] ?? 'product';
                    $item = $promotable;

                    if ($promotable instanceof \App\Models\SubscriptionPlan) {
                        $item = [
                            'id' => $promotable->id,
                            'slug' => $promotable->slug,
                            'name' => $promotable->name,
                            'title' => $promotable->name,
                            'description' => $promotable->description,
                            'price' => $promotable->price !== null ? (float) $promotable->price : null,
                            'billing_interval' => $promotable->billing_interval,
                            'interval_count' => $promotable->interval_count,
                            'status' => $promotable->status,
                        ];
                    }

                    if ($promotable instanceof \App\Models\Bundle) {
                        $bundleItems = $promotable->relationLoaded('items')
                            ? $promotable->items
                            : $promotable->items()->orderBy('sort_order')->get(['item_type', 'item_id', 'selected_variant_id', 'selected_variant_snapshot', 'sort_order']);

                        $productIds = $bundleItems->where('item_type', 'product')->pluck('item_id')->filter()->unique()->values();
                        $variantIds = $bundleItems->where('item_type', 'product')->pluck('selected_variant_id')->filter()->unique()->values();
                        $contentIds = $bundleItems->where('item_type', 'content_item')->pluck('item_id')->filter()->unique()->values();
                        $products = \App\Models\Product::query()
                            ->whereIn('id', $productIds)
                            ->with(['images:id,product_id,image_url,order'])
                            ->get(['id', 'slug', 'title', 'price', 'discounted_price', 'type', 'has_variants'])
                            ->keyBy('id');
                        $variants = \App\Models\ProductVariant::query()
                            ->whereIn('id', $variantIds)
                            ->where('is_active', true)
                            ->get(['id', 'product_id', 'name', 'sku', 'price', 'attributes', 'swatch_image_url'])
                            ->keyBy('id');
                        $contentItems = \App\Models\ContentItem::query()
                            ->whereIn('id', $contentIds)
                            ->get(['id', 'slug', 'title', 'price', 'visibility'])
                            ->keyBy('id');

                        $bundleItemCards = $bundleItems->map(function ($entry) use ($products, $variants, $contentItems) {
                            if ($entry->item_type === 'product') {
                                $product = $products->get((int) $entry->item_id);
                                if (!$product) return null;
                                $variant = null;
                                $selectedVariantId = (int) ($entry->selected_variant_id ?? 0);
                                if ($selectedVariantId > 0) {
                                    $candidate = $variants->get($selectedVariantId);
                                    if ($candidate && (int) $candidate->product_id === (int) $product->id) {
                                        $variant = $candidate;
                                    }
                                }
                                return [
                                    'item_type' => 'product',
                                    'item_id' => (int) $product->id,
                                    'slug' => $product->slug,
                                    'title' => $product->title,
                                    'price' => (float) ($variant?->price ?? $product->discounted_price ?? $product->price ?? 0),
                                    'image_url' => $variant?->swatch_image_url ?: $product->image_url,
                                    'product_type' => $product->type,
                                    'selected_variant_id' => $variant ? (int) $variant->id : ($selectedVariantId > 0 ? $selectedVariantId : null),
                                    'selected_variant' => $variant ? [
                                        'id' => (int) $variant->id,
                                        'name' => $variant->name,
                                        'sku' => $variant->sku,
                                        'price' => $variant->price !== null ? (float) $variant->price : null,
                                        'attributes' => $variant->attributes ?? [],
                                        'swatch_image_url' => $variant->swatch_image_url,
                                    ] : ($entry->selected_variant_snapshot ?: null),
                                    'is_available' => true,
                                ];
                            }

                            if ($entry->item_type === 'content_item') {
                                $content = $contentItems->get((int) $entry->item_id);
                                if (!$content) return null;
                                return [
                                    'item_type' => 'content_item',
                                    'item_id' => (int) $content->id,
                                    'slug' => $content->slug,
                                    'title' => $content->title,
                                    'price' => (float) ($content->price ?? 0),
                                    'image_url' => null,
                                    'product_type' => null,
                                    'selected_variant_id' => null,
                                    'selected_variant' => null,
                                    'is_available' => $content->visibility === 'published',
                                ];
                            }

                            return null;
                        })->filter()->values();

                        $item = [
                            'id' => $promotable->id,
                            'slug' => $promotable->slug,
                            'title' => $promotable->title,
                            'description' => $promotable->description,
                            'price' => $promotable->price !== null ? (float) $promotable->price : null,
                            'status' => $promotable->status,
                            'is_course' => (bool) ($promotable->is_course ?? false),
                            'is_individual_sale' => (bool) ($promotable->is_individual_sale ?? false),
                            'course_cover_image_url' => $promotable->course_cover_image_url,
                            'items_count' => $promotable->items_count ?? ($promotable->relationLoaded('items') ? $promotable->items->count() : $bundleItemCards->count()),
                            'bundle_items' => $bundleItemCards,
                        ];
                    }

                    return [
                        'id' => $promotable->id,
                        'type' => $resolvedType,
                        'item' => $item,
                    ];
                });
            }),

            'views_count' => $this->views_count,
            'click_count' => $this->click_count,
            'likes_count' => $this->likes_count,
            'like_count' => $this->likes_count,
            'comment_count' => $this->comment_count,
            'is_liked' => $this->isLikedBy($request->user()),
            'comments_enabled' => $commentsEnabled,
            'reactions_enabled' => $reactionsEnabled,
            'is_deleted' => $isDeleted,
            'comments_enabled_override' => $this->comments_enabled_override,
            'reactions_enabled_override' => $this->reactions_enabled_override,
            'reaction_summary' => $reactionSummary,
            'my_reaction' => $myReaction,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            
            // Structured Media (Hide if restricted and no access)
            'media' => (!$hasAccess && $isRestricted) ? [] : $mediaItems->map(fn($item) => [
                'id' => $item->id,
                'url' => $item->url,
                'type' => $item->media_type,
                'likes_count' => $item->likes_count,
            ]),

            'images' => (!$hasAccess && $isRestricted) ? [] : $mediaItems->map(fn($item) => $item->url)->toArray(),
            'media_url' => (!$hasAccess && $isRestricted) ? null : ($fallbackMedia ? $fallbackMedia->url : null),
            'media_type' => (!$hasAccess && $isRestricted) ? 'locked' : ($fallbackMedia ? $fallbackMedia->media_type : 'text'),
            
            'merchant' => $this->merchant ? [
                'id' => $this->merchant->id,
                'name' => $this->merchant->display_name,
                'slug' => $this->merchant->username,
            ] : null,
            'merchant_profile' => $this->merchant ? [
                'id' => $this->merchant->id,
                'username' => $this->merchant->username,
                'display_name' => $this->merchant->display_name,
                'avatar_url' => $this->merchant->avatar_url,
                'bio' => $this->merchant->bio,
                'is_verified' => $this->merchant->is_verified,
            ] : null,
            'product' => $resolvedProduct ? ProductResource::make($resolvedProduct)->resolve($request) : null,
            'product_tags' => $this->whenLoaded(
                'productTags',
                fn() =>
                $this->productTags->map(fn($tag) => [
                    'product_id' => $tag->product_id,
                    'x' => $tag->x_coordinate,
                    'y' => $tag->y_coordinate,
                    'product' => ProductResource::make($tag->product)->resolve($request),
                ])
            ),
            'hotspots' => (!$hasAccess && $isRestricted) ? [] : $rawHotspots,
            'resolved_hotspots' => $resolvedHotspots,
        ];
    }

    private function effectiveCommentsEnabled(): bool
    {
        if (method_exists($this->resource, 'trashed') && $this->resource->trashed()) {
            return false;
        }

        if ($this->comments_enabled_override !== null) {
            return (bool) $this->comments_enabled_override;
        }

        $merchant = $this->merchant;
        if (!$merchant) {
            return true;
        }

        $merchant->loadMissing('storefrontSetting');
        return (bool) ($merchant->storefrontSetting?->allow_post_comments ?? true);
    }

    private function effectiveReactionsEnabled(): bool
    {
        if (method_exists($this->resource, 'trashed') && $this->resource->trashed()) {
            return false;
        }

        if ($this->reactions_enabled_override !== null) {
            return (bool) $this->reactions_enabled_override;
        }

        $merchant = $this->merchant;
        if (!$merchant) {
            return true;
        }

        $merchant->loadMissing('storefrontSetting');
        return (bool) ($merchant->storefrontSetting?->allow_post_reactions ?? true);
    }

    private function reactionSummary(): array
    {
        $rows = $this->relationLoaded('reactions')
            ? $this->reactions
            : $this->reactions()
                ->selectRaw('emoji, COUNT(*) as total')
                ->groupBy('emoji')
                ->get();

        if ($this->relationLoaded('reactions')) {
            return $rows
                ->groupBy('emoji')
                ->map(fn($items, $emoji) => ['emoji' => $emoji, 'count' => $items->count()])
                ->values()
                ->toArray();
        }

        return $rows->map(fn($row) => [
            'emoji' => $row->emoji,
            'count' => (int) ($row->total ?? 0),
        ])->toArray();
    }

    private function myReactionForUser(int $userId): ?string
    {
        if ($this->relationLoaded('reactions')) {
            return $this->reactions->firstWhere('user_id', $userId)?->emoji;
        }

        return $this->reactions()
            ->where('user_id', $userId)
            ->value('emoji');
    }
}
