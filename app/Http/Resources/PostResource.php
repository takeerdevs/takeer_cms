<?php

namespace App\Http\Resources;

use App\Services\EntitlementService;
use App\Services\TrackedLinkService;
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
        $resolvedProduct?->loadMissing(['unitType', 'packageContentUnitType', 'returnPolicy', 'faqs']);

        $this->loadMissing([
            'media.productImage',
            'linkPreview',
            'createdByUser:id,name',
            'createdByStaff:id,display_name,job_title,user_id',
            'promotableOfferingGroups.items.product.images',
            'promotableOfferingGroups.items.childGroup',
        ]);
        $mediaItems = $this->media ?? collect();
        $linkedContentItem = $this->relationLoaded('linkedContentItem') ? $this->linkedContentItem : null;
        $fallbackMedia = $mediaItems->first();
        $user = $request->user();
        $commentsEnabled = $this->effectiveCommentsEnabled();
        $reactionsEnabled = $this->effectiveReactionsEnabled();
        $isDeleted = method_exists($this->resource, 'trashed') ? (bool) $this->resource->trashed() : false;

        // ── Access Logic ─────────────────────────────────────────────────────
        $attachedPromotables = $this->promotables ?? collect();
        $gatedPromotables = $attachedPromotables->reject(fn ($promotable) => $promotable instanceof \App\Models\OfferingGroup);
        $hasPromotableGate = $gatedPromotables->isNotEmpty();
        $hasSingleUnlockPrice = $this->restricted_price !== null;
        $hasPaidLinkedContent = $linkedContentItem && $linkedContentItem->price !== null;
        $singleUnlockPrice = $this->restricted_price ?? ($hasPaidLinkedContent ? $linkedContentItem->price : null);
        $unlockItemType = $hasPaidLinkedContent ? 'content_item' : 'post';
        $unlockItemId = $hasPaidLinkedContent ? (int) $linkedContentItem->id : (int) $this->id;
        $isRestricted = (bool) ($this->is_restricted ?? false) || $hasPromotableGate || $hasSingleUnlockPrice || $hasPaidLinkedContent;
        $hasAccess = true;
        $isAdminViewer = (bool) ($user?->is_admin ?? false);
        $isOwnerViewer = $user && (int) ($this->merchant?->user_id ?? 0) === (int) $user->id;
        $latestModeration = $this->relationLoaded('latestModerationAction') ? $this->latestModerationAction : null;
        $canViewDeletedContent = !$isDeleted || $isAdminViewer || $isOwnerViewer;
        $canExposeOriginalMedia = $isAdminViewer || $isOwnerViewer;
        $showRemovedNotice = $isDeleted && !$canViewDeletedContent && (bool) ($latestModeration?->show_public_notice ?? true);

        if ($isRestricted && !$isAdminViewer && !$isOwnerViewer) {
            $hasAccess = false;
            if ($user) {
                // 1. Check access for the attached promotions (Bundles/Plans)
                if ($hasPromotableGate) {
                    $typeMap = [
                        \App\Models\Product::class => 'product',
                        \App\Models\Bundle::class => 'bundle',
                        \App\Models\SubscriptionPlan::class => 'subscription_plan',
                    ];
                    
                    foreach ($gatedPromotables as $promo) {
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

                // 3. Content published into the feed should unlock via the exact content item entitlement.
                if (!$hasAccess && $hasPaidLinkedContent) {
                    $hasAccess = app(EntitlementService::class)->hasAccess((int) $user->id, 'content_item', (int) $linkedContentItem->id);
                }
            }
        }

        $canInteractWithRestricted = !$isRestricted || $hasAccess;
        $reactionSummary = $canInteractWithRestricted ? $this->reactionSummary() : [];
        $myReaction = ($canInteractWithRestricted && $user) ? $this->myReactionForUser((int) $user->id) : null;
        $trackedLinkService = app(TrackedLinkService::class);
        $linkPreviewTrackedLink = ($hasAccess && $canViewDeletedContent && $this->linkPreview)
            ? $trackedLinkService->trackedLinkFor($this->linkPreview->final_url ?: $this->linkPreview->url, [
                'merchant_id' => $this->merchant_id,
                'link_type' => 'post_link_preview',
                'source_surface' => 'post',
                'entity_type' => 'post',
                'entity_id' => $this->id,
                'label' => $this->linkPreview->title,
                'metadata' => [
                    'post_public_id' => $this->public_id,
                    'link_preview_id' => $this->linkPreview->id,
                ],
            ])
            : null;

        // ── Masking ──────────────────────────────────────────────────────────
        $displayCaption = ($hasAccess && $canViewDeletedContent) ? $this->caption : null;
        $displayBody = ($hasAccess && $canViewDeletedContent)
            ? ($linkedContentItem?->body ?? $this->body)
            : null;
        $displayTitle = $canViewDeletedContent ? ($linkedContentItem?->title ?: ($this->title ?: $resolvedProduct?->title)) : null;
        $displayExcerpt = ($hasAccess && $canViewDeletedContent) ? ($this->excerpt
            ?: $linkedContentItem?->excerpt
            ?: (is_string($resolvedProduct?->description ?? null) ? trim((string) $resolvedProduct->description) : null)) : null;
        $isLongFormPost = !empty($displayBody) || !empty($displayExcerpt);

        $rawHotspots = $this->hotspots;
        if (!$rawHotspots || !is_array($rawHotspots)) {
            $rawHotspots = $mediaItems->mapWithKeys(function ($item, $index) {
                $spots = $item?->productImage?->hotspots;
                return [$index => is_array($spots) ? $spots : []];
            })->toArray();
        }

        $resolvedHotspots = (!$canViewDeletedContent || (!$hasAccess && $isRestricted))
            ? []
            : collect($rawHotspots)->map(function ($spots) use ($request) {
                return collect($spots)->map(function ($spot) use ($request) {
                    if (isset($spot['type']) && $spot['type'] === 'product' && isset($spot['data'])) {
                        $product = \App\Models\Product::with(['images', 'attributes', 'merchant', 'unitType', 'packageContentUnitType', 'returnPolicy', 'faqs'])->find($spot['data']);
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
            'forwarder_id' => $this->forwarder_id,
            'forwarder_route_id' => $this->forwarder_route_id,
            'forwarder_route_label' => $this->forwarder_route_label,
            'forwarder_route_snapshot' => $this->forwarder_route_snapshot,
            'source' => $this->source,
            'created_by' => $this->creatorPayload(),
            'content_item_id' => $linkedContentItem?->id,
            'caption' => $displayCaption,
            'title' => $displayTitle,
            'excerpt' => $displayExcerpt,
            'body' => $displayBody,
            'content_format' => $linkedContentItem?->format,
            'bg_style' => $this->bg_style,
            'post_type' => $isLongFormPost ? 'long' : 'short',
            'is_restricted' => $isRestricted,
            'has_access' => $hasAccess,
            'restricted_price' => $singleUnlockPrice,
            'unlock_item_type' => $unlockItemType,
            'unlock_item_id' => $unlockItemId,
            'link_preview' => ($hasAccess && $canViewDeletedContent && $this->linkPreview && in_array($this->linkPreview->status, ['success', 'fallback'], true)) ? [
                'id' => $this->linkPreview->id,
                'status' => $this->linkPreview->status,
                'url' => $this->linkPreview->url,
                'final_url' => $this->linkPreview->final_url,
                'tracked_url' => $linkPreviewTrackedLink?->isActive() ? route('tracked-links.follow', $linkPreviewTrackedLink->code) : null,
                'tracked_link_status' => $linkPreviewTrackedLink?->status,
                'link_unavailable' => $linkPreviewTrackedLink ? ! $linkPreviewTrackedLink->isActive() : false,
                'title' => $this->linkPreview->title,
                'description' => $this->linkPreview->description,
                'site_name' => $this->linkPreview->site_name,
                'favicon_url' => $this->linkPreview->favicon_url,
                'image_url' => $this->linkPreview->image_url,
                'remote_image_url' => $this->linkPreview->remote_image_url,
                'embed' => $this->linkPreview->embed_url ? [
                    'provider' => $this->linkPreview->embed_provider,
                    'type' => $this->linkPreview->embed_type,
                    'url' => $this->linkPreview->embed_url,
                    'external_id' => $this->linkPreview->external_id,
                ] : null,
            ] : null,
            
            'promotables' => $this->when($this->promotables->isNotEmpty(), function () use ($user) {
                return $this->promotables->map(function ($promotable) use ($user) {
                    $typeMap = [
                        \App\Models\Product::class => 'product',
                        \App\Models\Bundle::class => 'bundle',
                        \App\Models\SubscriptionPlan::class => 'subscription_plan',
                        \App\Models\OfferingGroup::class => 'offering_group',
                    ];
                    $resolvedType = $typeMap[get_class($promotable)] ?? 'product';
                    $item = $promotable;

                    if ($promotable instanceof \App\Models\SubscriptionPlan) {
                        $viewerSubscription = $user
                            ? app(\App\Services\SubscriptionRenewalService::class)->activeSubscriptionFor((int) $user->id, (int) $promotable->id)
                            : null;

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
                            'items_count' => $promotable->relationLoaded('items')
                                ? $promotable->items->count()
                                : $promotable->items()->count(),
                            'viewer_subscription' => $viewerSubscription ? [
                                'id' => $viewerSubscription->id,
                                'status' => $viewerSubscription->status,
                                'current_period_start' => $viewerSubscription->current_period_start?->toISOString(),
                                'current_period_end' => $viewerSubscription->current_period_end?->toISOString(),
                                'next_billing_at' => $viewerSubscription->next_billing_at?->toISOString(),
                                'auto_renew' => (bool) $viewerSubscription->auto_renew,
                            ] : null,
                        ];
                    }

                    if ($promotable instanceof \App\Models\Product) {
                        $item = [
                            'id' => $promotable->id,
                            'slug' => $promotable->slug,
                            'title' => $promotable->title,
                            'description' => $promotable->description ?? null,
                            'price' => $promotable->price !== null ? (float) $promotable->price : null,
                            'type' => $promotable->type,
                            'image_url' => $promotable->image_url,
                        ];
                    }

                    if ($promotable instanceof \App\Models\Bundle) {
                        $bundleItems = $promotable->relationLoaded('items')
                            ? $promotable->items
                            : $promotable->items()->orderBy('sort_order')->get([
                                'item_type',
                                'item_id',
                                'selected_variant_id',
                                'selected_variant_snapshot',
                                'section_title',
                                'lesson_title',
                                'lesson_summary',
                                'supporting_materials',
                                'lesson_duration_minutes',
                                'unlock_after_days',
                                'is_preview',
                                'sort_order',
                            ]);

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
                                    'section_title' => $entry->section_title,
                                    'lesson_title' => $entry->lesson_title,
                                    'lesson_summary' => $entry->lesson_summary,
                                    'supporting_materials' => $entry->supporting_materials ?? [],
                                    'lesson_duration_minutes' => $entry->lesson_duration_minutes,
                                    'unlock_after_days' => (int) ($entry->unlock_after_days ?? 0),
                                    'is_preview' => (bool) ($entry->is_preview ?? false),
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
                                    'section_title' => $entry->section_title,
                                    'lesson_title' => $entry->lesson_title,
                                    'lesson_summary' => $entry->lesson_summary,
                                    'supporting_materials' => $entry->supporting_materials ?? [],
                                    'lesson_duration_minutes' => $entry->lesson_duration_minutes,
                                    'unlock_after_days' => (int) ($entry->unlock_after_days ?? 0),
                                    'is_preview' => (bool) ($entry->is_preview ?? false),
                                    'selected_variant_id' => null,
                                    'selected_variant' => null,
                                    'is_available' => $content->visibility === 'published',
                                ];
                            }

                            return null;
                        })->filter()->values();

                        $courseModules = $promotable->relationLoaded('courseModules')
                            ? $promotable->courseModules
                            : $promotable->courseModules()
                                ->with(['lessons.assets', 'lessons.liveSession'])
                                ->orderBy('sort_order')
                                ->get();

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
                            'course_modules' => $courseModules->map(fn ($module) => [
                                'id' => $module->id,
                                'title' => $module->title,
                                'sort_order' => (int) ($module->sort_order ?? 0),
                                'lessons' => $module->lessons->map(fn ($lesson) => [
                                    'id' => $lesson->id,
                                    'title' => $lesson->title,
                                    'summary' => $lesson->summary,
                                    'duration_minutes' => $lesson->duration_minutes !== null ? (int) $lesson->duration_minutes : null,
                                    'unlock_after_days' => (int) ($lesson->unlock_after_days ?? 0),
                                    'is_preview' => (bool) ($lesson->is_preview ?? false),
                                    'assets' => $lesson->assets->map(fn ($asset) => [
                                        'role' => $asset->role,
                                        'asset_type' => $asset->asset_type,
                                        'asset_id' => $asset->asset_id !== null ? (int) $asset->asset_id : null,
                                        'name' => $asset->name,
                                        'url' => $asset->url,
                                        'mime' => $asset->mime,
                                        'size' => $asset->size !== null ? (int) $asset->size : null,
                                    ])->values(),
                                    'live_session' => $lesson->liveSession ? [
                                        'starts_at' => $lesson->liveSession->starts_at?->toISOString(),
                                        'duration_minutes' => $lesson->liveSession->duration_minutes !== null ? (int) $lesson->liveSession->duration_minutes : null,
                                        'timezone' => $lesson->liveSession->timezone,
                                        'meeting_url' => $lesson->liveSession->meeting_url,
                                        'venue' => $lesson->liveSession->venue,
                                        'capacity' => $lesson->liveSession->capacity !== null ? (int) $lesson->liveSession->capacity : null,
                                    ] : null,
                                ])->values(),
                            ])->values(),
                            'items_count' => $promotable->items_count ?? ($promotable->relationLoaded('items') ? $promotable->items->count() : $bundleItemCards->count()),
                            'bundle_items' => $bundleItemCards,
                        ];
                    }

                    if ($promotable instanceof \App\Models\OfferingGroup) {
                        $groupItems = $promotable->relationLoaded('items')
                            ? $promotable->items
                            : $promotable->items()->limit(8)->get();

                        $item = [
                            'id' => $promotable->id,
                            'slug' => $promotable->slug,
                            'title' => $promotable->title,
                            'description' => $promotable->description,
                            'price' => $promotable->base_price !== null ? (float) $promotable->base_price : null,
                            'status' => $promotable->status,
                            'group_type' => $promotable->group_type,
                            'template_key' => $promotable->template_key,
                            'checkout_mode' => $promotable->checkout_mode,
                            'pricing_mode' => $promotable->pricing_mode,
                            'image_url' => $promotable->cover_image_url,
                            'items_count' => $promotable->relationLoaded('items')
                                ? $promotable->items->count()
                                : $promotable->items()->count(),
                            'items' => $groupItems->map(function ($entry) {
                                $model = $entry->itemModel();
                                $isProduct = $model instanceof \App\Models\Product;
                                $productMedia = $isProduct ? $model->images->first() : null;

                                return [
                                    'id' => $entry->id,
                                    'item_type' => $entry->item_type,
                                    'item_id' => $entry->item_id,
                                    'title' => $model?->title,
                                    'description' => $model?->description,
                                    'section' => $entry->section,
                                    'role' => $entry->role,
                                    'pricing_behavior' => $entry->pricing_behavior,
                                    'price' => $isProduct
                                        ? ($model->discounted_price !== null ? (float) $model->discounted_price : (float) ($model->price ?? 0))
                                        : ($model?->base_price !== null ? (float) $model->base_price : null),
                                    'image_url' => $isProduct ? $model->image_url : ($model?->cover_image_url ?? null),
                                    'media_type' => $isProduct ? ($productMedia?->media_type ?: 'image') : 'image',
                                    'thumbnail_url' => $isProduct ? ($productMedia?->thumbnail_url ?: $model->image_url) : ($model?->cover_image_url ?? null),
                                    'add_ons' => $isProduct && is_array($model->module_details ?? null)
                                        ? collect($model->module_details['add_ons'] ?? [])->take(4)->values()->all()
                                        : [],
                                ];
                            })->values(),
                            'url' => url('/offerings/' . $promotable->id),
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
            'is_liked' => $request->user()
                ? (array_key_exists('is_liked_by_viewer', $this->getAttributes())
                    ? (bool) $this->getAttribute('is_liked_by_viewer')
                    : $this->isLikedBy($request->user()))
                : false,
            'comments_enabled' => $commentsEnabled,
            'reactions_enabled' => $reactionsEnabled,
            'is_deleted' => $isDeleted,
            'removed_notice' => $showRemovedNotice,
            'moderation' => $latestModeration ? [
                'action' => $latestModeration->action,
                'reason_code' => $latestModeration->reason_code,
                'public_reason' => $latestModeration->public_reason,
                'internal_note' => $isAdminViewer ? $latestModeration->internal_note : null,
                'show_public_notice' => (bool) $latestModeration->show_public_notice,
                'created_at' => $latestModeration->created_at,
            ] : null,
            'comments_enabled_override' => $this->comments_enabled_override,
            'reactions_enabled_override' => $this->reactions_enabled_override,
            'reaction_summary' => $reactionSummary,
            'my_reaction' => $myReaction,
            'deleted_at' => $this->deleted_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            
            // Structured Media (Hide if restricted and no access)
            'media' => (!$canViewDeletedContent || (!$hasAccess && $isRestricted)) ? [] : $mediaItems->map(fn($item) => [
                'id' => $item->id,
                'url' => $item->media_type === 'video' ? ($item->processed_url ?: $item->url) : $item->url,
                'original_url' => $canExposeOriginalMedia ? $item->url : null,
                'type' => $item->media_type,
                'media_type' => $item->media_type,
                'thumbnail_url' => $item->thumbnail_url,
                'processed_url' => $item->processed_url,
                'hls_url' => $item->hls_url,
                'mime' => $item->mime,
                'size' => $item->size !== null ? (int) $item->size : null,
                'duration_seconds' => $item->duration_seconds !== null ? (int) $item->duration_seconds : null,
                'width' => $item->width !== null ? (int) $item->width : null,
                'height' => $item->height !== null ? (int) $item->height : null,
                'processing_status' => $item->processing_status ?: 'ready',
                'likes_count' => $item->likes_count,
            ]),

            'images' => (!$canViewDeletedContent || (!$hasAccess && $isRestricted)) ? [] : $mediaItems->map(fn($item) => [
                'id' => $item->id,
                'url' => $item->media_type === 'video' ? ($item->processed_url ?: $item->url) : $item->url,
                'original_url' => $canExposeOriginalMedia ? $item->url : null,
                'type' => $item->media_type,
                'media_type' => $item->media_type,
                'thumbnail_url' => $item->thumbnail_url,
                'processed_url' => $item->processed_url,
                'hls_url' => $item->hls_url,
                'mime' => $item->mime,
                'size' => $item->size !== null ? (int) $item->size : null,
                'duration_seconds' => $item->duration_seconds !== null ? (int) $item->duration_seconds : null,
                'width' => $item->width !== null ? (int) $item->width : null,
                'height' => $item->height !== null ? (int) $item->height : null,
                'processing_status' => $item->processing_status ?: 'ready',
            ])->toArray(),
            'media_url' => (!$canViewDeletedContent || (!$hasAccess && $isRestricted)) ? null : ($fallbackMedia ? ($fallbackMedia->media_type === 'video' ? ($fallbackMedia->processed_url ?: $fallbackMedia->url) : $fallbackMedia->url) : null),
            'media_type' => (!$canViewDeletedContent || (!$hasAccess && $isRestricted)) ? ($showRemovedNotice ? 'removed' : 'locked') : ($fallbackMedia ? $fallbackMedia->media_type : 'text'),
            
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

    private function creatorPayload(): ?array
    {
        $staff = $this->relationLoaded('createdByStaff') ? $this->createdByStaff : null;
        $user = $this->relationLoaded('createdByUser') ? $this->createdByUser : null;

        if (! $staff && ! $user) {
            return null;
        }

        $displayName = $staff?->display_name
            ?: $staff?->job_title
            ?: $user?->name;

        return [
            'user_id' => $user?->id,
            'staff_id' => $staff?->id,
            'name' => $displayName,
            'user_name' => $user?->name,
            'job_title' => $staff?->job_title,
            'label' => $displayName ? "via {$displayName}" : null,
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
