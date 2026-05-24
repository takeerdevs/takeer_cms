<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MerchantAuthController;
use App\Http\Controllers\Api\MerchantBusinessOverviewController;
use App\Http\Controllers\Api\MerchantBundleController;
use App\Http\Controllers\Api\MerchantCommunicationController;
use App\Http\Controllers\Api\MerchantCourseController;
use App\Http\Controllers\Api\MerchantCustomerController;
use App\Http\Controllers\Api\MerchantContentController;
use App\Http\Controllers\Api\EntitlementController;
use App\Http\Controllers\Api\ContentReportModerationController;
use App\Http\Controllers\Api\DispatchController;
use App\Http\Controllers\Api\MerchantModuleSetupController;
use App\Http\Controllers\Api\MerchantOrderController;
use App\Http\Controllers\Api\MerchantPlatformSubscriptionController;
use App\Http\Controllers\Api\MerchantSubscriptionPlanController;
use App\Http\Controllers\Api\MerchantMarketingController;
use App\Http\Controllers\Api\MerchantAnalyticsExportController;
use App\Http\Controllers\Api\MerchantStaffController;
use App\Http\Controllers\Api\RiderDeliveryController;
use App\Http\Controllers\Api\ServiceRequestController;
use App\Http\Controllers\Api\ServiceCategoryController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminCatalogController;
use App\Http\Controllers\Api\AdminFeePolicyController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\AdminTrackedLinkController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\MerchantProfileController;
use App\Http\Controllers\OfferingGroupController;
use App\Http\Controllers\TrackedLinkController;
use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\SubscriptionPlanResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\AdminSetting;
use App\Models\Post;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ServiceCategory;
use App\Models\SubscriptionPlan;
use App\Models\Country;
use App\Models\Currency;
use App\Services\EntitlementService;
use App\Services\SubscriptionRenewalService;
use App\Support\SeoMeta;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// ─── PUBLIC PAYMENT PAGES (Commerce Pro) ───────────────────────────────────
Route::get('/pay/retail-credit/{publicId}', [\App\Http\Controllers\Api\RetailCreditPaymentController::class, 'show'])->name('retail-credit-payment.show');
Route::get('/pay/{slug}', [\App\Http\Controllers\Api\PublicPaymentPageController::class, 'show'])->name('payment-page.show');
Route::get('/rider/delivery/{token}', [RiderDeliveryController::class, 'show'])->name('rider.delivery.show');
Route::match(['get', 'post'], '/bookkeeping-share/{token}', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'publicShare'])->name('bookkeeping.share');
Route::get('/bookkeeping-share/{token}/download', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'publicShareDownload'])->name('bookkeeping.share.download');

Route::get('/', function (Request $request) {
    $query = App\Models\Post::with([
        'merchant.storefrontSetting',
        'linkPreview',
        'linkedContentItem',
        'media.productImage',
        'linkedProduct.attributes',
        'linkedProduct.variants',
        'linkedProduct.images',
        'linkedProduct.unitType',
        'linkedProduct.packageContentUnitType',
        'linkedProduct.returnPolicy',
        'linkedProduct.faqs',
        'product.attributes',
        'product.variants',
        'product.unitType',
        'product.packageContentUnitType',
        'product.returnPolicy',
        'product.faqs',
        'productTags.product.attributes',
        'productTags.product.variants',
        'productTags.product.images',
        'productTags.product.unitType',
        'productTags.product.packageContentUnitType',
        'productTags.product.returnPolicy',
        'productTags.product.faqs',
        'reactions',
        'promotableProducts',
        'promotableBundles',
        'promotableSubscriptions',
        'promotableOfferingGroups.items.product.images',
        'promotableOfferingGroups.items.childGroup',
    ]);

    if ($request->user()) {
        $query->withExists([
            'likes as is_liked_by_viewer' => fn ($likes) => $likes->where('user_id', $request->user()->id),
        ]);
    }

    $posts = app(\App\Services\DiscoveryRankingService::class)->rankPostQuery($query)->simplePaginate(8);

    $initialFeed = PostResource::collection($posts)->response()->getData(true);
    $seo = SeoMeta::home();

    return Inertia::render('Feed', [
        'initialFeed' => $initialFeed,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});

Route::get('/p/{postPublicId}', [PostController::class, 'showByPublicId'])->name('post.show');
Route::get('/posts/{post}/comments', [PostController::class, 'comments'])->withTrashed();
Route::post('/posts/{post}/guest-engagement', [PostController::class, 'guestEngagement'])
    ->withTrashed()
    ->middleware('throttle:6,10');
Route::get('/sms/t/{code}', [MerchantMarketingController::class, 'followSmsLink'])->name('sms.track');
Route::get('/dm/t/{event}', [MerchantMarketingController::class, 'followSocialDmLink'])->name('social-dm.track');
Route::get('/wa/t/{event}', [MerchantMarketingController::class, 'followWhatsappLink'])->name('whatsapp.track');
Route::get('/go/{code}', [TrackedLinkController::class, 'follow'])
    ->middleware('throttle:120,1')
    ->name('tracked-links.follow');
Route::post('/go/{code}/report', [TrackedLinkController::class, 'report'])
    ->middleware('throttle:12,10')
    ->name('tracked-links.report');
Route::get('/offerings/{offeringGroup:id}', [OfferingGroupController::class, 'show'])
    ->name('offering-groups.show');
Route::get('/r/{code}', [MerchantMarketingController::class, 'followReferral'])->name('referral.follow');
Route::get('/campaign/{merchant:username}/{code}', [MerchantMarketingController::class, 'showCampaignLanding'])->name('campaign.show');
Route::get('/group-sale/{slug}', [MerchantMarketingController::class, 'showGroupSale'])->name('group-sale.show');
Route::post('/group-sale/{slug}/join', [MerchantMarketingController::class, 'joinGroupSale'])->name('group-sale.join');
Route::get('/product/{product}/video-stream', [\App\Http\Controllers\Api\DownloadController::class, 'streamProductVideo'])
    ->middleware('auth')
    ->name('product.video.stream');
Route::get('/product/{product}/audio-stream', [\App\Http\Controllers\Api\DownloadController::class, 'streamProductAudio'])
    ->middleware('auth')
    ->name('product.audio.stream');
Route::get('/product/{product}/gallery/{index}', [\App\Http\Controllers\Api\DownloadController::class, 'streamProductGalleryItem'])
    ->whereNumber('index')
    ->middleware('auth')
    ->name('product.gallery.item');
Route::get('/product/{product}/gallery/{index}/original', [\App\Http\Controllers\Api\DownloadController::class, 'downloadProductGalleryOriginal'])
    ->whereNumber('index')
    ->middleware('auth')
    ->name('product.gallery.original');
Route::get('/product/{product}/document/read', [\App\Http\Controllers\Api\DownloadController::class, 'readProductDocument'])
    ->middleware('auth')
    ->name('product.document.read');
Route::get('/product/{product}/releases/{release}/download', [\App\Http\Controllers\Api\ProductReleaseController::class, 'download'])
    ->middleware('auth')
    ->name('product.releases.download');
Route::get('/product/{product}/video/hls/{path}', [\App\Http\Controllers\Api\DownloadController::class, 'streamProductVideoHls'])
    ->where('path', '.*')
    ->middleware('auth')
    ->name('product.video.hls');

Route::get('/product/{product}', function (Product $product) {
    $product->load([
        'merchant.user',
        'merchant.storefrontSetting',
        'attributes.brand',
        'attributes.model',
        'unitType',
        'packageContentUnitType',
        'returnPolicy',
        'faqs',
        'images',
        'variants',
        'categoryAttributeValues.categoryAttribute'
    ]);

    // Ensure available_stock is included
    $product->append('available_stock');
    $kycEnforcementMode = (string) AdminSetting::get('kyc_enforcement_mode', 'off');
    $product->setAttribute('verification_required_for_listing', $kycEnforcementMode === 'listings_and_withdrawals');
    $groupSaleSlug = trim((string) request()->query('group_sale', ''));
    if ($groupSaleSlug !== '') {
        $groupSale = \App\Models\MerchantGroupSaleCampaign::query()
            ->where('slug', $groupSaleSlug)
            ->where('product_id', $product->id)
            ->whereIn('status', ['active', 'successful'])
            ->first();

        if ($groupSale) {
            $product->setAttribute('group_sale_offer', [
                'id' => $groupSale->id,
                'slug' => $groupSale->slug,
                'title' => $groupSale->title,
                'campaign_price' => (float) $groupSale->campaign_price,
                'regular_price' => $groupSale->regular_price !== null ? (float) $groupSale->regular_price : null,
                'goal_quantity' => (int) $groupSale->goal_quantity,
                'reserved_quantity' => (int) $groupSale->reserved_quantity,
                'progress_percent' => $groupSale->progressPercent(),
                'status' => $groupSale->status,
                'is_checkout_open' => $groupSale->status === 'successful' || $groupSale->reserved_quantity >= $groupSale->goal_quantity,
            ]);
        }
    }

    // Track traffic
    $product->recordImpression(request());
    $seo = SeoMeta::product($product);

    return Inertia::render('ProductDetail', [
        'product' => ProductResource::make($product)->resolve(),
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('product.show');

Route::get('/service-requests/{publicId}/pay/{token}', function (string $publicId, string $token) {
    $serviceRequest = \App\Models\ServiceRequest::query()
        ->where('public_id', $publicId)
        ->where('payment_token', $token)
        ->with([
            'product.merchant.user',
            'product.merchant.storefrontSetting',
            'product.attributes.brand',
            'product.attributes.model',
            'product.unitType',
            'product.packageContentUnitType',
            'product.returnPolicy',
            'product.faqs',
            'product.images',
            'product.variants',
            'product.categoryAttributeValues.categoryAttribute',
        ])
        ->firstOrFail();

    $paymentStatus = (string) $serviceRequest->payment_status;
    $paymentComplete = in_array($paymentStatus, ['paid', 'held', 'released', 'disputed'], true);

    abort_unless(
        in_array($serviceRequest->status, ['quoted', 'confirmed'], true)
        && (float) $serviceRequest->quoted_amount > 0
        && ($paymentComplete || !$serviceRequest->payment_link_expires_at || $serviceRequest->payment_link_expires_at->isFuture()),
        404
    );

    $product = $serviceRequest->product;
    abort_unless($product && $product->type === 'service', 404);
    $product->append('available_stock');
    $product->setAttribute('checkout_price', (float) $serviceRequest->quoted_amount);
    $product->setAttribute('verification_required_for_listing', false);
    $product->setAttribute('service_request_payment', [
        'id' => $serviceRequest->id,
        'public_id' => $serviceRequest->public_id,
        'token' => $serviceRequest->payment_token,
        'quoted_amount' => (float) $serviceRequest->quoted_amount,
        'total_amount' => isset($serviceRequest->metadata['service_total_amount'])
            ? (float) $serviceRequest->metadata['service_total_amount']
            : (float) $serviceRequest->quoted_amount,
        'advance_amount' => $serviceRequest->deposit_amount !== null ? (float) $serviceRequest->deposit_amount : null,
        'remaining_amount' => isset($serviceRequest->metadata['service_total_amount'])
            ? max(0, (float) $serviceRequest->metadata['service_total_amount'] - (float) $serviceRequest->quoted_amount)
            : 0,
        'status' => $serviceRequest->status,
        'payment_status' => $serviceRequest->payment_status,
        'delivery_status' => $serviceRequest->delivery_status,
        'expires_at' => $serviceRequest->payment_link_expires_at?->toISOString(),
    ]);

    $seo = SeoMeta::product($product);

    return Inertia::render('ProductDetail', [
        'product' => ProductResource::make($product)->resolve(),
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('service-request.pay');

Route::get('/search', function (Request $request) {
    $detectedCountryIso = $request->session()->get('user_session_country.iso_alpha2');
    $detectedCountryId = $detectedCountryIso
        ? Country::query()->where('iso_alpha2', strtoupper((string) $detectedCountryIso))->value('id')
        : null;

    $seo = SeoMeta::search(trim((string) $request->query('q', '')));

    return Inertia::render('Search', [
        'initialQuery' => trim((string) $request->query('q', '')),
        'initialPage' => max((int) $request->query('page', 1), 1),
        'initialFilters' => [
            'type' => (string) $request->query('type', 'all'),
            'surface' => (string) $request->query('surface', 'all'),
            'category_id' => $request->query('category_id'),
            'sub_category_id' => $request->query('sub_category_id'),
            'service_category_id' => $request->query('service_category_id'),
            'service_subcategory_id' => $request->query('service_subcategory_id'),
            'service_category' => trim((string) $request->query('service_category', '')),
            'service_subcategory' => trim((string) $request->query('service_subcategory', '')),
            'country_id' => $request->query('country_id', $detectedCountryId),
            'location' => trim((string) $request->query('location', '')),
            'lat' => $request->query('lat'),
            'lng' => $request->query('lng'),
            'radius_km' => $request->query('radius_km', 25),
        ],
        'countries' => Country::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'iso_alpha2', 'flag', 'city_name', 'state_name']),
        'productCategories' => ProductCategory::query()
            ->with(['children' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order')->orderBy('name')])
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'slug']),
        'serviceCategories' => ServiceCategory::query()
            ->with(['children' => fn ($query) => $query->where('is_active', true)->orderBy('sort_order')->orderBy('name')])
            ->whereNull('parent_id')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name', 'slug']),
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('search.page');

Route::get('/content/{contentItem}', function (Request $request, string $contentItem, EntitlementService $entitlementService) {
    $internalShortTitle = '__short_locked__';
    $contentItem = ContentItem::withTrashed()->where('slug', $contentItem)->firstOrFail();
    $linkedPost = Post::query()
        ->where('content_item_id', $contentItem->id)
        ->latest('id')
        ->first();

    if ($linkedPost) {
        return redirect()->route('post.show', $linkedPost->public_id ?? (string) $linkedPost->id);
    }

    $contentItem->load('merchant');
    $user = $request->user();
    $isOwner = $user?->merchantProfiles()->where('id', $contentItem->merchant_id)->exists() ?? false;
    $isFree = $contentItem->price === null;
    $hasAccess = $isOwner || $isFree || ($user && $entitlementService->hasAccess($user->id, 'content_item', $contentItem->id));
    $isPublished = $contentItem->visibility === 'published';
    abort_unless($isPublished || $isOwner || $hasAccess, 404);
    $previewBody = null;

    if (!$hasAccess) {
        if ($contentItem->format === 'editorjs') {
            $decoded = json_decode((string) $contentItem->body, true);
            $chunks = [];

            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded['blocks'] ?? null)) {
            foreach ($decoded['blocks'] as $block) {
                $type = $block['type'] ?? null;
                $data = is_array($block['data'] ?? null) ? $block['data'] : [];

                if (in_array($type, ['header', 'paragraph', 'quote'], true)) {
                    $chunks[] = trim(strip_tags((string) ($data['text'] ?? '')));
                    continue;
                }

                if ($type === 'list') {
                    foreach ((array) ($data['items'] ?? []) as $entry) {
                        $content = is_array($entry) ? ($entry['content'] ?? '') : $entry;
                        $chunks[] = trim(strip_tags((string) $content));
                    }
                    continue;
                }

                if ($type === 'checklist') {
                    foreach ((array) ($data['items'] ?? []) as $entry) {
                        $chunks[] = trim(strip_tags((string) ($entry['text'] ?? '')));
                    }
                }
            }
            }

            $previewBody = trim(implode("\n\n", array_filter($chunks)));
        } else {
            $previewBody = trim(strip_tags((string) $contentItem->body));
        }

        $isLockedPaid = $contentItem->price !== null;
        if ($isLockedPaid) {
            if ($contentItem->format === 'plain_text') {
                $previewBody = 'Unlock this short post to read the full text.';
            } else {
                $limit = $contentItem->format === 'plain_text' ? 90 : 220;
                $previewBody = Str::limit($previewBody, $limit);
                if (!$previewBody) {
                    $previewBody = 'Preview hidden. Unlock this content to read everything.';
                }
            }
        }
    }

    $seo = SeoMeta::content($contentItem);

    return Inertia::render('ContentItemDetail', [
        'contentItem' => [
            'id' => $contentItem->id,
            'title' => ($contentItem->format === 'plain_text' && trim((string) $contentItem->title) === $internalShortTitle)
                ? null
                : $contentItem->title,
            'slug' => $contentItem->slug,
            'excerpt' => (!$hasAccess && $contentItem->price !== null && $contentItem->format === 'plain_text')
                ? null
                : trim((string) preg_replace('/\s*Tap unlock to continue\.\s*$/i', '', (string) $contentItem->excerpt)),
            'format' => $contentItem->format,
            'visibility' => $contentItem->visibility,
            'price' => $contentItem->price !== null ? (float) $contentItem->price : null,
            'merchant' => [
                'id' => $contentItem->merchant->id,
                'name' => $contentItem->merchant->display_name,
                'display_name' => $contentItem->merchant->display_name,
                'slug' => $contentItem->merchant->username,
            ],
        ],
        'hasAccess' => (bool) $hasAccess,
        'previewBody' => $previewBody,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('content.show');

Route::get('/bundle/{bundle}', function (Bundle $bundle) {
    abort_if($bundle->status !== 'published', 404);

    $bundle->load(['merchant.locations', 'items', 'courseModules.lessons.assets', 'courseModules.lessons.liveSession', 'cohorts']);
    $productIds = $bundle->items->where('item_type', 'product')->pluck('item_id')->filter()->unique()->values();
    $variantIds = $bundle->items->where('item_type', 'product')->pluck('selected_variant_id')->filter()->unique()->values();
    $contentIds = $bundle->items->where('item_type', 'content_item')->pluck('item_id')->filter()->unique()->values();
    $productLookup = Product::query()
        ->whereIn('id', $productIds)
        ->with(['images:id,product_id,image_url,order'])
        ->get(['id', 'title', 'price', 'discounted_price', 'type', 'has_variants', 'shipping_profile_id'])
        ->keyBy('id');
    $variantLookup = \App\Models\ProductVariant::query()
        ->whereIn('id', $variantIds)
        ->where('is_active', true)
        ->get(['id', 'product_id', 'name', 'sku', 'price', 'attributes', 'swatch_image_url'])
        ->keyBy('id');
    $contentLookup = ContentItem::query()
        ->whereIn('id', $contentIds)
        ->get(['id', 'title', 'price'])
        ->keyBy('id');

    $bundlePayload = $bundle->toArray();
    $bundlePayload['course_modules'] = $bundle->courseModules->map(fn ($module) => [
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
            'sort_order' => (int) ($lesson->sort_order ?? 0),
            'assets' => $lesson->assets->map(fn ($asset) => [
                'id' => $asset->id,
                'role' => $asset->role,
                'asset_type' => $asset->asset_type,
                'asset_id' => $asset->asset_id !== null ? (int) $asset->asset_id : null,
                'selected_variant_id' => $asset->selected_variant_id !== null ? (int) $asset->selected_variant_id : null,
                'selected_variant_snapshot' => $asset->selected_variant_snapshot,
                'name' => $asset->name,
                'url' => $asset->url,
                'mime' => $asset->mime,
                'size' => $asset->size !== null ? (int) $asset->size : null,
                'sort_order' => (int) ($asset->sort_order ?? 0),
            ])->values()->all(),
            'live_session' => $lesson->liveSession ? [
                'id' => $lesson->liveSession->id,
                'starts_at' => $lesson->liveSession->starts_at?->toISOString(),
                'duration_minutes' => $lesson->liveSession->duration_minutes !== null ? (int) $lesson->liveSession->duration_minutes : null,
                'timezone' => $lesson->liveSession->timezone,
                'meeting_url' => $lesson->liveSession->meeting_url,
                'venue' => $lesson->liveSession->venue,
                'capacity' => $lesson->liveSession->capacity !== null ? (int) $lesson->liveSession->capacity : null,
                'notes' => $lesson->liveSession->notes,
            ] : null,
        ])->values()->all(),
    ])->values()->all();
    $bundlePayload['cohorts'] = $bundle->cohorts->map(fn ($cohort) => [
        'id' => $cohort->id,
        'name' => $cohort->name,
        'starts_at' => $cohort->starts_at?->toISOString(),
        'enrollment_deadline' => $cohort->enrollment_deadline?->toISOString(),
        'capacity' => $cohort->capacity !== null ? (int) $cohort->capacity : null,
        'access_rule' => $cohort->access_rule,
        'status' => $cohort->status,
    ])->values()->all();
    $bundlePayload['items'] = $bundle->items->map(function ($item) use ($productLookup, $variantLookup, $contentLookup) {
        if ($item->item_type === 'product') {
            $product = $productLookup->get((int) $item->item_id);
            $variant = null;
            $selectedVariantId = (int) ($item->selected_variant_id ?? 0);
            if ($selectedVariantId > 0) {
                $candidate = $variantLookup->get($selectedVariantId);
                if ($candidate && (int) $candidate->product_id === (int) $item->item_id) {
                    $variant = $candidate;
                }
            }

            $variantSnapshot = $variant ? [
                'id' => (int) $variant->id,
                'name' => $variant->name,
                'sku' => $variant->sku,
                'price' => $variant->price !== null ? (float) $variant->price : null,
                'attributes' => $variant->attributes ?? [],
                'swatch_image_url' => $variant->swatch_image_url,
            ] : ($item->selected_variant_snapshot ?: null);

            return [
                'id' => $item->id,
                'item_type' => $item->item_type,
                'item_id' => (int) $item->item_id,
                'selected_variant_id' => $variant ? (int) $variant->id : ($selectedVariantId > 0 ? $selectedVariantId : null),
                'selected_variant_snapshot' => $variantSnapshot,
                'section_title' => $item->section_title,
                'lesson_title' => $item->lesson_title,
                'lesson_summary' => $item->lesson_summary,
                'supporting_materials' => $item->supporting_materials ?? [],
                'lesson_duration_minutes' => $item->lesson_duration_minutes,
                'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
                'is_preview' => (bool) ($item->is_preview ?? false),
                'sort_order' => (int) ($item->sort_order ?? 0),
                'title' => $product?->title ?: "Product #{$item->item_id}",
                'price' => $variant ? (float) ($variant->price ?? 0) : ($product ? (float) ($product->discounted_price ?? $product->price ?? 0) : 0),
                'image_url' => $variant?->swatch_image_url ?: $product?->image_url,
                'product_type' => $product?->type,
                'shipping_profile_id' => $product?->shipping_profile_id,
            ];
        }

        if ($item->item_type === 'content_item') {
            $content = $contentLookup->get((int) $item->item_id);
            return [
                'id' => $item->id,
                'item_type' => $item->item_type,
                'item_id' => (int) $item->item_id,
                'selected_variant_id' => null,
                'selected_variant_snapshot' => null,
                'section_title' => $item->section_title,
                'lesson_title' => $item->lesson_title,
                'lesson_summary' => $item->lesson_summary,
                'supporting_materials' => $item->supporting_materials ?? [],
                'lesson_duration_minutes' => $item->lesson_duration_minutes,
                'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
                'is_preview' => (bool) ($item->is_preview ?? false),
                'sort_order' => (int) ($item->sort_order ?? 0),
                'title' => $content?->title ?: "Content #{$item->item_id}",
                'price' => $content ? (float) ($content->price ?? 0) : 0,
                'image_url' => null,
                'product_type' => null,
                'shipping_profile_id' => null,
            ];
        }

        return [
            'id' => $item->id,
            'item_type' => $item->item_type,
            'item_id' => (int) $item->item_id,
            'selected_variant_id' => null,
            'selected_variant_snapshot' => null,
            'section_title' => $item->section_title,
            'lesson_title' => $item->lesson_title,
            'lesson_summary' => $item->lesson_summary,
            'supporting_materials' => $item->supporting_materials ?? [],
            'lesson_duration_minutes' => $item->lesson_duration_minutes,
            'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
            'is_preview' => (bool) ($item->is_preview ?? false),
            'sort_order' => (int) ($item->sort_order ?? 0),
            'title' => "{$item->item_type} #{$item->item_id}",
            'price' => 0,
            'image_url' => null,
            'product_type' => null,
            'shipping_profile_id' => null,
        ];
    })->values()->all();

    $bundlePayload['merchant'] = [
        'id' => $bundle->merchant->id,
        'name' => $bundle->merchant->name,
        'display_name' => $bundle->merchant->display_name,
        'username' => $bundle->merchant->username,
        'slug' => $bundle->merchant->username,
        'can_self_pickup' => $bundle->merchant->locations->where('allow_self_pickup', true)->isNotEmpty(),
        'locations' => $bundle->merchant->locations->map(fn ($loc) => [
            'id' => $loc->id,
            'name' => $loc->name,
            'address' => $loc->address,
            'latitude' => $loc->latitude !== null ? (float) $loc->latitude : null,
            'longitude' => $loc->longitude !== null ? (float) $loc->longitude : null,
            'allow_self_pickup' => (bool) $loc->allow_self_pickup,
            'contact_phone' => $loc->contact_phone,
        ])->values()->all(),
    ];

    $seo = SeoMeta::bundle($bundle);

    return Inertia::render('BundleDetail', [
        'bundle' => $bundlePayload,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('bundle.show');

Route::get('/plan/{subscriptionPlan}', function (SubscriptionPlan $subscriptionPlan) {
    abort_if($subscriptionPlan->status !== 'active', 404);

    $subscriptionPlan->load(['merchant', 'items']);
    $viewer = request()->user();
    $isOwner = $viewer && (int) $subscriptionPlan->merchant?->user_id === (int) $viewer->id;
    $hasPlanAccess = (bool) ($viewer?->is_admin ?? false) || $isOwner;

    if (! $hasPlanAccess && $viewer) {
        $hasPlanAccess = app(EntitlementService::class)->hasAccess(
            (int) $viewer->id,
            'subscription_plan',
            (int) $subscriptionPlan->id
        );
    }

    if (! $hasPlanAccess && $viewer) {
        $hasPlanAccess = \App\Models\UserSubscription::query()
            ->where('user_id', $viewer->id)
            ->where('subscription_plan_id', $subscriptionPlan->id)
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('current_period_end')->orWhere('current_period_end', '>', now());
            })
            ->exists();
    }

    $viewerSubscription = $viewer
        ? app(SubscriptionRenewalService::class)->activeSubscriptionFor((int) $viewer->id, (int) $subscriptionPlan->id)
        : null;

    $contentItemIds = $subscriptionPlan->items
        ->where('item_type', 'content_item')
        ->pluck('item_id')
        ->filter()
        ->unique()
        ->values();

    $planContent = ContentItem::query()
        ->whereIn('id', $contentItemIds)
        ->latest('published_at')
        ->get(['id', 'slug', 'title', 'excerpt', 'published_at', 'created_at'])
        ->map(fn ($item) => [
            'id' => $item->id,
            'type' => 'content_item',
            'slug' => $item->slug,
            'title' => $item->title,
            'excerpt' => $item->excerpt,
            'created_at' => $item->published_at ?? $item->created_at,
        ]);

    $linkedPosts = Post::query()
        ->join('post_promotables', 'post_promotables.post_id', '=', 'posts.id')
        ->where('post_promotables.promotable_type', SubscriptionPlan::class)
        ->where('post_promotables.promotable_id', $subscriptionPlan->id)
        ->where('posts.is_restricted', true)
        ->select('posts.id', 'posts.public_id', 'posts.title', 'posts.excerpt', 'posts.caption', 'posts.created_at')
        ->latest('posts.created_at')
        ->get()
        ->map(fn ($post) => [
            'id' => $post->id,
            'type' => 'post',
            'public_id' => $post->public_id,
            'title' => $post->title,
            'excerpt' => 'Unlock this premium post to read the full content.',
            'created_at' => $post->created_at,
        ]);

    $allPreviewContent = $planContent
        ->concat($linkedPosts)
        ->sortByDesc('created_at')
        ->values();

    $communityPosts = collect();
    $communityPostBase = Post::query()
        ->whereHas('promotableSubscriptions', fn ($query) => $query->whereKey($subscriptionPlan->id));
    if ($hasPlanAccess) {
        $communityPosts = Post::query()
            ->with([
                'merchant.storefrontSetting',
                'linkPreview',
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
                'promotableProducts',
                'promotableBundles',
                'promotableSubscriptions',
            ])
            ->whereHas('promotableSubscriptions', fn ($query) => $query->whereKey($subscriptionPlan->id))
            ->latest()
            ->take(20)
            ->get();
    }

    $seo = SeoMeta::subscriptionPlan($subscriptionPlan);

    return Inertia::render('SubscriptionPlanDetail', [
        'subscriptionPlan' => SubscriptionPlanResource::make($subscriptionPlan)->resolve(request()),
        'hasAccess' => $hasPlanAccess,
        'viewerSubscription' => $viewerSubscription ? [
            'id' => $viewerSubscription->id,
            'status' => $viewerSubscription->status,
            'current_period_start' => $viewerSubscription->current_period_start?->toISOString(),
            'current_period_end' => $viewerSubscription->current_period_end?->toISOString(),
            'next_billing_at' => $viewerSubscription->next_billing_at?->toISOString(),
            'auto_renew' => (bool) $viewerSubscription->auto_renew,
        ] : null,
        'communityPosts' => PostResource::collection($communityPosts)->resolve(request()),
        'communityStats' => [
            'posts_count' => (clone $communityPostBase)->count(),
            'posts_30d' => (clone $communityPostBase)->where('posts.created_at', '>=', now()->subDays(30))->count(),
            'comments_count' => (int) (clone $communityPostBase)->sum('comment_count'),
            'reactions_count' => (int) (clone $communityPostBase)->sum('likes_count'),
        ],
        'contentPreview' => $allPreviewContent->take(3)->values()->all(),
        'totalLinkedContent' => $allPreviewContent->count(),
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('subscription-plan.show');

// Onboarding/login landing (passwordless entry for users who aren't logged in yet)
$welcomePage = function (Request $request) {
    $seo = SeoMeta::home();

    return Inertia::render('Welcome', [
        'intended' => $request->session()->get('url.intended'),
        'seo' => $seo,
    ])->withViewData('seo', $seo);
};

Route::get('/welcome', $welcomePage)->name('login');
Route::get('/login', $welcomePage)->name('login.page');

Route::get('/terms', function () {
    $seo = SeoMeta::staticPage('Terms of Service', 'Read the Takeer terms of service for buyers, sellers, creators, and businesses.', '/terms');

    return Inertia::render('Terms', [
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('terms');

Route::get('/privacy', function () {
    $seo = SeoMeta::staticPage('Privacy Policy', 'Learn how Takeer handles personal data, privacy, and account information.', '/privacy');

    return Inertia::render('Privacy', [
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('privacy');

Route::get('/{merchantSlug}/terminal', function (string $merchantSlug) {
    $merchant = \App\Models\Merchant::where('username', $merchantSlug)->firstOrFail();
    $seo = SeoMeta::make([
        'title' => 'Staff Terminal | '.$merchant->display_name,
        'description' => 'Staff sign-in terminal for '.$merchant->display_name.'.',
        'canonical' => url('/'.$merchantSlug.'/terminal'),
        'robots' => 'noindex,nofollow',
    ]);

    return Inertia::render('Auth/StaffPinLogin', [
        'merchant' => $merchant,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
})->name('retail.terminal');

Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::get('/feed', function (Request $request) {
    $query = App\Models\Post::with([
        'merchant.storefrontSetting',
        'linkPreview',
        'linkedContentItem',
        'media.productImage',
        'linkedProduct.attributes',
        'linkedProduct.images',
        'linkedProduct.variants',
        'linkedProduct.unitType',
        'linkedProduct.packageContentUnitType',
        'linkedProduct.returnPolicy',
        'linkedProduct.faqs',
        'product.attributes',
        'product.images',
        'product.variants',
        'product.unitType',
        'product.packageContentUnitType',
        'product.returnPolicy',
        'product.faqs',
        'productTags.product.attributes',
        'productTags.product.images',
        'productTags.product.variants',
        'productTags.product.unitType',
        'productTags.product.packageContentUnitType',
        'productTags.product.returnPolicy',
        'productTags.product.faqs',
        'reactions',
        'promotableProducts',
        'promotableBundles',
        'promotableSubscriptions',
        'promotableOfferingGroups.items.product.images',
        'promotableOfferingGroups.items.childGroup',
    ]);

    if ($request->user()) {
        $query->withExists([
            'likes as is_liked_by_viewer' => fn ($likes) => $likes->where('user_id', $request->user()->id),
        ]);
    }

    $posts = app(\App\Services\DiscoveryRankingService::class)->rankPostQuery($query)->simplePaginate(8);

    $initialFeed = PostResource::collection($posts)->response()->getData(true);
    $seo = SeoMeta::feed();

    return Inertia::render('Feed', [
        'initialFeed' => $initialFeed,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});

// ─── AUTH (Stateful) ───────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/otp/send', [AuthController::class, 'sendOtp'])->middleware('throttle:5,10');
    Route::post('/otp/verify', [AuthController::class, 'verifyOtp'])->middleware('throttle:6,10');
    Route::post('/merchant/check', [MerchantAuthController::class, 'check']);
    Route::post('/merchant/register', [MerchantAuthController::class, 'register']);
    Route::post('/merchant/ensure-personal', [MerchantAuthController::class, 'ensurePersonalProfile'])->middleware('auth');
    Route::post('/session/bootstrap', [AuthController::class, 'bootstrapSession'])->middleware('auth:sanctum');
});

// ─── GOOGLE OAUTH ───────────────────────────────────────────────────────────
Route::get('/auth/google/redirect', function () {
    return \Laravel\Socialite\Facades\Socialite::driver('google')->redirect();
});

Route::get('/auth/google/callback', function (\Illuminate\Http\Request $request) {
    try {
        $googleUser = \Laravel\Socialite\Facades\Socialite::driver('google')->user();
        $email = $googleUser->getEmail();

        if (! $email) {
            $fallback = $request->user() ? '/profile/settings' : '/welcome';
            return redirect($fallback)->with('error', 'Imeshindwa kupata barua pepe (email).');
        }

        $currentUser = $request->user();

        if ($currentUser) {
            $currentUser->email = $email;
            $currentUser->email_verified_at = now();
            $currentUser->save();

            return redirect('/profile/settings')->with('success', 'Akaunti yako ya Google imeunganishwa kikamilifu!');
        }

        $user = \App\Models\User::where('email', $email)->first();

        if (! $user) {
            $user = \App\Models\User::create([
                'name' => $googleUser->getName() ?: explode('@', $email)[0],
                'email' => $email,
                'email_verified_at' => now(),
                'role' => 'buyer',
            ]);
        } elseif (! $user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        if (! $user->wallet) {
            \App\Models\Wallet::create(['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]);
        }

        \Illuminate\Support\Facades\Auth::guard('web')->login($user, true);
        $request->session()->regenerate();

        return redirect($request->session()->pull('url.intended', '/feed'))->with('success', 'Karibu Takeer!');
    } catch (\Exception $e) {
        $fallback = $request->user() ? '/profile/settings' : '/welcome';
        return redirect($fallback)->with('error', 'Kuna tatizo wakati wa kuunganisha na Google.');
    }
});

// ─── MERCHANT ───────────────────────────────────────────────────────────────
Route::get('/merchant/register', function () {
    $seo = SeoMeta::staticPage(
        'Create Your Takeer Business Profile',
        'Create a Takeer profile to sell services, physical products, digital products, accept bookings, and manage customer interactions online.',
        '/merchant/register'
    );

    return Inertia::render('Auth/MerchantRegister', [
        'countries' => Country::select('id', 'name', 'iso_alpha2 as code', 'default_currency_id', 'timezone', 'settings')->get(),
        'currencies' => Currency::select('id', 'code', 'symbol', 'name')->get(),
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});

Route::middleware('auth')->group(function () {
    // Post interactions via session-auth web guard (reliable for Inertia pages)
    Route::get('/posts/{post}/comments', [PostController::class, 'comments'])->withTrashed();
    Route::post('/posts/{post}/comment', [PostController::class, 'storeComment'])->withTrashed();
    Route::post('/posts/{post}/like', [PostController::class, 'toggleLike'])->withTrashed();
    Route::post('/posts/{post}/react', [PostController::class, 'react'])->withTrashed();

    Route::get('/orders', function () {
        return Inertia::render('Orders');
    });

    // Buyer Hub data endpoints using web session auth (more reliable than Sanctum for Inertia pages)
    Route::get('/orders/data/pulse', [EntitlementController::class, 'myPulse']);
    Route::get('/orders/data/entitlements', [EntitlementController::class, 'myLibrary']);
    Route::get('/orders/data/subscriptions', [SubscriptionController::class, 'mySubscriptions']);
    Route::get('/orders/data/entitlements/{entitlement}/access', [\App\Http\Controllers\Api\DownloadController::class, 'entitlementAccess']);
    Route::get('/orders/data/entitlements/{entitlement}/download/local', [\App\Http\Controllers\Api\DownloadController::class, 'downloadEntitlementLocal'])->name('web.download.entitlement-local');
    Route::get('/orders/{order}/download', [\App\Http\Controllers\Api\DownloadController::class, 'download']);
    Route::get('/orders/{order}/download/local', [\App\Http\Controllers\Api\DownloadController::class, 'downloadLocal'])->name('web.download.local');
    Route::get('/orders/{order}/download/custom-local', [\App\Http\Controllers\Api\DownloadController::class, 'downloadCustomLocal'])->name('web.download.custom-local');
    Route::get('/learn/bundles/{bundle}', [\App\Http\Controllers\Api\BundleCourseController::class, 'show'])->name('bundle.learn');
    Route::post('/learn/bundle-lessons/{lesson}/complete', [\App\Http\Controllers\Api\BundleCourseController::class, 'toggleCompletion'])->name('bundle.lesson.complete');
    Route::post('/learn/bundle-live-sessions/{session}/check-in', [\App\Http\Controllers\Api\BundleCourseController::class, 'checkIn'])->name('bundle.live-session.check-in');

    Route::post('/merchant/switch/{username}', [\App\Http\Controllers\Api\MerchantSwitchController::class, 'switch'])->name('merchant.switch');
    Route::post('/merchant/add-business', [\App\Http\Controllers\Api\MerchantAuthController::class, 'addBusinessProfile'])->name('merchant.add-business');
    Route::get('/merchant/social/meta/callback', [MerchantMarketingController::class, 'handleMetaCallback'])->name('merchant.social.meta.callback');

    Route::get('/profile', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        
        // Determine active merchant
        $activeMerchantId = Session::get('active_merchant_id');
        $merchantProfiles = \App\Support\MerchantPermissions::accessibleMerchantsFor($user);
        
        $activeMerchant = $activeMerchantId 
            ? $merchantProfiles->find($activeMerchantId) 
            : ($merchantProfiles->where('is_default', true)->first() ?? $merchantProfiles->first());
        $activeMerchantAccess = $activeMerchant
            ? \App\Support\MerchantPermissions::accessSummary($user, $activeMerchant)
            : null;

        if ($activeMerchant
            && (string) \App\Models\AdminSetting::get('retail_access_mode', 'free') === 'free'
            && $activeMerchant->isRetailEligible()
            && ! $activeMerchant->hasModule('retail_ops')
        ) {
            $modules = $activeMerchant->active_modules ?? [];
            $modules[] = 'retail_ops';
            $activeMerchant->forceFill(['active_modules' => array_values(array_unique($modules))])->save();
            $activeMerchant->refresh()->load(['kyc', 'locations']);
            $merchantProfiles = $merchantProfiles->map(fn ($merchant) => (int) $merchant->id === (int) $activeMerchant->id ? $activeMerchant : $merchant);
        }

        $merchantIds = $activeMerchant ? [$activeMerchant->id] : $merchantProfiles->pluck('id');

        // This Month Earnings
        $thisMonthEarnings = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid']) 
            ->whereMonth('created_at', \Carbon\Carbon::now()->month)
            ->whereYear('created_at', \Carbon\Carbon::now()->year)
            ->sum('total_paid');

        // Weekly Stats for Overview Cards
        $startOfWeek = \Carbon\Carbon::now()->startOfWeek();
        $paymentsThisWeek = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->where('created_at', '>=', $startOfWeek)
            ->sum('total_paid');

        $transactionsThisWeek = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->where('created_at', '>=', $startOfWeek)
            ->count();

        // Previous Week for Comparison
        $startOfLastWeek = \Carbon\Carbon::now()->subWeek()->startOfWeek();
        $endOfLastWeek = \Carbon\Carbon::now()->subWeek()->endOfWeek();
        $paymentsLastWeek = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->whereBetween('created_at', [$startOfLastWeek, $endOfLastWeek])
            ->sum('total_paid');
        
        $percentChange = $paymentsLastWeek > 0 
            ? round((($paymentsThisWeek - $paymentsLastWeek) / $paymentsLastWeek) * 100, 1)
            : ($paymentsThisWeek > 0 ? 100 : 0);

        // Sales Breakdown
        $orders = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->with('product:id,type')
            ->get(['id', 'purchasable_type', 'product_id', 'quantity']);

        $breakdown = ['digital' => 0, 'physical' => 0, 'services' => 0];
        foreach ($orders as $order) {
            $qty = $order->quantity ?? 1;
            if ($order->purchasable_type === 'product' && $order->product) {
                if ($order->product->type === 'physical') $breakdown['physical'] += $qty;
                elseif ($order->product->type === 'service') $breakdown['services'] += $qty;
                else $breakdown['digital'] += $qty;
            } else {
                $breakdown['digital'] += $qty;
            }
        }

        $commerceHubSummary = [
            'physical' => 0,
            'menu' => 0,
            'digital' => 0,
            'services' => 0,
            'rooms' => 0,
            'tour_departures' => 0,
            'custom_orders' => 0,
            'appointments' => 0,
            'reservations' => 0,
            'rentals' => 0,
            'workshops' => 0,
            'posts' => 0,
            'bundles' => 0,
            'offerings' => 0,
            'subscriptions' => 0,
        ];

        if ($activeMerchant) {
            $productTypeCounts = $activeMerchant->products()
                ->selectRaw('type, COUNT(*) as total')
                ->groupBy('type')
                ->pluck('total', 'type');
            $productModuleCounts = $activeMerchant->products()
                ->whereNotNull('module_key')
                ->selectRaw('module_key, COUNT(*) as total')
                ->groupBy('module_key')
                ->pluck('total', 'module_key');

            $commerceHubSummary = [
                'physical' => (int) ($productTypeCounts['physical'] ?? 0),
                'menu' => (int) ($productModuleCounts['menu'] ?? 0),
                'digital' => (int) ($productTypeCounts['digital'] ?? 0),
                'services' => (int) ($productTypeCounts['service'] ?? 0),
                'rooms' => (int) ($productModuleCounts['rooms'] ?? 0),
                'tour_departures' => (int) ($productModuleCounts['tour_departures'] ?? 0),
                'custom_orders' => (int) ($productModuleCounts['custom_orders'] ?? 0),
                'appointments' => (int) ($productModuleCounts['appointments'] ?? 0),
                'reservations' => (int) ($productModuleCounts['reservations'] ?? 0),
                'rentals' => (int) ($productModuleCounts['rentals'] ?? 0),
                'workshops' => (int) ($productModuleCounts['workshops'] ?? 0),
                'posts' => (int) $activeMerchant->posts()->count(),
                'bundles' => (int) $activeMerchant->bundles()->count(),
                'offerings' => (int) $activeMerchant->offeringGroups()->count(),
                'subscriptions' => (int) $activeMerchant->subscriptionPlans()->count(),
            ];
        }

        $creatorMonetization = null;
        if ($activeMerchant) {
            $paidOrders = $activeMerchant->orders()
                ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
                ->where('created_at', '>=', now()->subDays(30))
                ->with('product:id,title,type,digital_delivery_type,digital_content_type')
                ->get(['id', 'merchant_id', 'product_id', 'purchasable_type', 'purchasable_id', 'payment_status', 'total_paid', 'quantity', 'created_at']);
            $previousPaidOrders = $activeMerchant->orders()
                ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
                ->whereBetween('created_at', [now()->subDays(60), now()->subDays(30)])
                ->get(['id', 'total_paid']);

            $bucketLabels = [
                'premium_media' => 'Premium media',
                'digital_downloads' => 'Downloads/assets',
                'live_events' => 'Live events',
                'creator_club' => 'Creator Club',
                'custom_work' => 'Custom work',
                'paid_writing' => 'Paid writing',
                'courses_bundles' => 'Courses/bundles',
                'services' => 'Services',
                'physical' => 'Physical',
            ];
            $buckets = collect($bucketLabels)->map(fn ($label, $key) => [
                'key' => $key,
                'label' => $label,
                'revenue' => 0.0,
                'released' => 0.0,
                'pending' => 0.0,
                'orders' => 0,
                'units' => 0,
            ])->all();
            $topItemRows = [];
            $resolveBucket = function ($order): string {
                if ($order->purchasable_type === 'subscription_plan') return 'creator_club';
                if (in_array($order->purchasable_type, ['post', 'content_item'], true)) return 'paid_writing';
                if ($order->purchasable_type === 'bundle') return 'courses_bundles';
                if ($order->product?->type === 'service') return 'services';
                if ($order->product?->type === 'physical') return 'physical';
                if (in_array($order->product?->digital_delivery_type, ['video_stream', 'audio_stream', 'gallery_pack'], true)) return 'premium_media';
                if ($order->product?->digital_delivery_type === 'live_event') return 'live_events';
                if ($order->product?->digital_delivery_type === 'custom_delivery') return 'custom_work';
                return 'digital_downloads';
            };

            foreach ($paidOrders as $order) {
                $bucket = $resolveBucket($order);
                $amount = (float) $order->total_paid;
                $qty = (int) ($order->quantity ?: 1);

                $buckets[$bucket]['revenue'] += $amount;
                $buckets[$bucket][$order->payment_status === 'resolved_merchant_paid' ? 'released' : 'pending'] += $amount;
                $buckets[$bucket]['orders'] += 1;
                $buckets[$bucket]['units'] += $qty;

                $display = $user->resolveOrderDisplay($order);
                $topKey = $order->purchasable_type . ':' . ($order->product_id ?: $order->purchasable_id ?: $display['title']);
                $topItemRows[$topKey] ??= [
                    'title' => $display['title'] ?: ($order->product?->title ?? 'Offer'),
                    'kind' => $display['kind'],
                    'icon' => $display['icon'],
                    'bucket' => $bucket,
                    'bucket_label' => $bucketLabels[$bucket],
                    'revenue' => 0.0,
                    'orders' => 0,
                    'units' => 0,
                ];
                $topItemRows[$topKey]['revenue'] += $amount;
                $topItemRows[$topKey]['orders'] += 1;
                $topItemRows[$topKey]['units'] += $qty;
            }

            $activeMembers = \App\Models\UserSubscription::where('merchant_id', $activeMerchant->id)
                ->where('status', 'active')
                ->where(function ($query) {
                    $query->whereNull('current_period_end')
                        ->orWhere('current_period_end', '>', now());
                })
                ->count();
            $orderIds = $paidOrders->pluck('id')->all();
            $transactionQuery = \App\Models\Transaction::query()
                ->whereIn('order_id', $orderIds)
                ->where('type', 'order_revenue');
            $transactionTotals = (clone $transactionQuery)
                ->selectRaw('COALESCE(SUM(gross_amount), 0) as gross, COALESCE(SUM(fee_amount), 0) as fees, COALESCE(SUM(net_amount), 0) as net')
                ->first();
            $wallet = $activeMerchant->wallet()->firstOrCreate(
                ['merchant_id' => $activeMerchant->id],
                ['user_id' => $activeMerchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
            );
            $pendingWithdrawals = \App\Models\WithdrawalRequest::query()
                ->where('merchant_id', $activeMerchant->id)
                ->where('status', 'pending')
                ->sum('amount');
            $totalRevenue = (float) $paidOrders->sum(fn ($order) => (float) $order->total_paid);
            $pendingRevenue = (float) $paidOrders->where('payment_status', 'escrow_locked')->sum('total_paid');
            $previousRevenue = (float) $previousPaidOrders->sum(fn ($order) => (float) $order->total_paid);
            $revenueChange = $previousRevenue > 0
                ? round((($totalRevenue - $previousRevenue) / $previousRevenue) * 100, 1)
                : ($totalRevenue > 0 ? 100 : 0);

            $creatorMonetization = [
                'window' => 'Last 30 days',
                'total_revenue' => $totalRevenue,
                'total_orders' => $paidOrders->count(),
                'active_members' => $activeMembers,
                'released_revenue' => (float) $paidOrders->where('payment_status', 'resolved_merchant_paid')->sum('total_paid'),
                'pending_revenue' => $pendingRevenue,
                'estimated_fees' => (float) ($transactionTotals->fees ?? 0),
                'estimated_net' => (float) (($transactionTotals->net ?? 0) ?: max($totalRevenue - (float) ($transactionTotals->fees ?? 0), 0)),
                'revenue_change_percent' => $revenueChange,
                'payouts' => [
                    'available_balance' => (float) $wallet->balance,
                    'held_balance' => (float) $wallet->frozen_balance,
                    'pending_withdrawals' => (float) $pendingWithdrawals,
                ],
                'buckets' => collect($buckets)->map(function ($bucket) use ($totalRevenue) {
                    $bucket['share'] = $totalRevenue > 0 ? round(((float) $bucket['revenue'] / $totalRevenue) * 100, 1) : 0;
                    return $bucket;
                })->values()->all(),
                'top_items' => collect($topItemRows)->sortByDesc('revenue')->take(5)->values()->all(),
            ];
        }

        return Inertia::render('Profile', [
            'activeMerchant' => $activeMerchant,
            'activeMerchantAccess' => $activeMerchantAccess,
            'thisMonthEarnings' => (float) $thisMonthEarnings,
            'weeklyStats' => [
                'payments' => (float) $paymentsThisWeek,
                'transactions' => $transactionsThisWeek,
                'percentChange' => $percentChange,
            ],
            'summary' => $activeMerchant ? [
                'total_products' => $activeMerchant->products()->count(),
                'orders_today'   => $activeMerchant->orders()->whereDate('created_at', now()->today())->count(),
                'orders_pending' => $activeMerchant->orders()->whereIn('payment_status', ['awaiting_payment', 'escrow_locked'])->count(),
                'orders_completed' => $activeMerchant->orders()->whereIn('payment_status', ['resolved_merchant_paid'])->count(),
            ] : null,
            'recentOrders' => $activeMerchant ? $activeMerchant->orders()
                ->with(['product:id,title,type,url,download_link', 'product.images'])
                ->latest()
                ->take(5)
                ->get()
                ->map(function($order) use ($user) {
                    $display = $user->resolveOrderDisplay($order);
                    return [
                        'id' => $order->id,
                        'amount' => (float) $order->total_paid,
                        'status' => $order->payment_status,
                        'created_at' => $order->created_at?->toISOString(),
                        'display_title' => $display['title'],
                        'display_kind' => $display['kind'],
                        'display_icon' => $display['icon'],
                        'image_url' => $order->product?->image_url,
                    ];
                }) : [],
            'salesBreakdown' => $breakdown,
            'commerceHubSummary' => $commerceHubSummary,
            'creatorMonetization' => $creatorMonetization,
            'countries' => \App\Models\Country::select('id', 'name', 'iso_alpha2 as code', 'default_currency_id')->get(),
            'currencies' => \App\Models\Currency::select('id', 'code', 'symbol', 'name')->get(),
            'businessCategories' => \App\Support\BusinessCategoryRegistry::all(),
            'businessOperations' => \App\Support\BusinessOperationRegistry::all(),
            'businessModules' => \App\Support\BusinessModuleRegistry::all(),
            'commerceModes' => \App\Support\CommerceModeRegistry::all(),
            'merchantKyc' => $activeMerchant ? $activeMerchant->kyc : null,
            'merchantKycStatus' => $activeMerchant ? ($activeMerchant->kyc_status ?? 'unverified') : 'unverified',
        ]);
    });

    Route::get('/profile/settings', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        $oneClickProfile = $user->oneClickProfile;

        return Inertia::render('Profile/Settings', [
            'oneClickProfile' => $oneClickProfile,
        ]);
    })->name('profile.settings');

    Route::post('/profile/settings', function (\Illuminate\Http\Request $request) {
        $validated = $request->validate([
            'email' => 'nullable|email|max:255',
            'payment_provider' => 'nullable|string',
            'payment_number' => 'nullable|string|regex:/^\+[1-9]\d{1,14}$/',
            'delivery_landmark' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
        ], [
            'payment_number.regex' => 'Namba ya malipo lazima ianze na alama ya jumlisha na kodi ya nchi mfano +255 au +254.',
        ]);

        $user = $request->user();

        // Save email on user
        if (isset($validated['email']) && $validated['email'] !== '') {
            $user->email = $validated['email'];
            $user->save();
        }

        // Save remaining fields on OneClickProfile
        $user->oneClickProfile()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'payment_provider' => $validated['payment_provider'] ?? null,
                'payment_number' => $validated['payment_number'] ?? null,
                'delivery_landmark' => $validated['delivery_landmark'] ?? null,
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]
        );

        return back()->with('success', 'Mipangilio imehifadhiwa kikamilifu!');
    });

    Route::post('/merchant/create', function (\Illuminate\Http\Request $request) {
        $validated = $request->validate([
            'store_name' => 'required|string|max:100',
            'display_name' => 'required|string|max:100',
            'country_id' => 'required|exists:countries,id',
            'currency_id' => 'required|exists:currencies,id',
            'timezone' => 'nullable|timezone',
        ]);

        $user = $request->user();
        if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

        // Generate a unique username slug for minstore
        $baseUsername = \Illuminate\Support\Str::slug($validated['store_name'] ?? 'shop');
        $username = $baseUsername;
        $counter = 1;
        while (\App\Models\Merchant::where('username', $username)->exists()) {
            $username = $baseUsername . '-' . $counter;
            $counter++;
        }

        // Ensure user is merchant type
        if ($user->role !== 'merchant') {
            $user->role = 'merchant';
            $user->save();
        }

        $country = \App\Models\Country::find($validated['country_id']);
        $countryTimezones = $country?->timezones() ?? [];
        $timezone = in_array($validated['timezone'] ?? null, $countryTimezones, true)
            ? $validated['timezone']
            : ($country?->defaultTimezone() ?? 'Africa/Dar_es_Salaam');

        // Create the new merchant profile
        $merchant = \App\Models\Merchant::create([
            'user_id' => $user->id,
            'username' => $username,
            'display_name' => $validated['display_name'],
            'is_verified' => false,
            'is_default' => !$user->merchantProfiles()->exists(), // true if first shop
            'country_id' => $validated['country_id'],
            'currency_id' => $validated['currency_id'],
            'timezone' => $timezone,
        ]);

        return redirect()->to('/merchant/' . $merchant->username . '/dashboard');
    })->name('merchant.create');

    Route::get('/chat/{order}', function (Request $request, $order) {
        $orderModel = \App\Models\Order::with(['product.images', 'delivery.events', 'merchant.locations', 'messages' => fn($q) => $q->orderBy('created_at')])->where('public_id', $order)->firstOrFail();
        $user = $request->user();

        $merchantIds = $user->merchantProfiles()->pluck('id');
        $isParticipant = (int) $orderModel->buyer_id === (int) $user->id
            || $merchantIds->contains((int) ($orderModel->merchant_id ?? 0))
            || (bool) ($user->is_admin ?? false)
            || ($user->role ?? null) === 'admin';

        abort_unless($isParticipant, 403);

        $isEscrowOrder = $orderModel->requiresPhysicalFulfillment();
        $orderFlow = $isEscrowOrder ? 'escrow' : 'instant';

        $actingAs = $request->query('acting_as', 'buyer');
        if ($actingAs === 'merchant') {
            abort_unless($merchantIds->contains((int) ($orderModel->merchant_id ?? 0)), 403, 'Unauthorized merchant context');
        } else {
            abort_unless((int) $orderModel->buyer_id === (int) $user->id || (bool) ($user->is_admin ?? false) || ($user->role ?? null) === 'admin', 403, 'Unauthorized buyer context');
        }

        $extraItems = collect($orderModel->extra_items ?? []);
        if ($extraItems->isNotEmpty()) {
            $productsById = \App\Models\Product::query()
                ->whereIn('id', $extraItems->pluck('id')->filter()->unique()->values())
                ->get()
                ->keyBy('id');

            $orderModel->setAttribute('extra_items', $extraItems->map(function ($item) use ($productsById) {
                $product = $productsById->get((int) ($item['id'] ?? 0));
                if (!$product) {
                    return $item;
                }

                return [
                    ...$item,
                    'type' => $item['type'] ?? $product->type,
                    'product_type' => $item['product_type'] ?? $product->type,
                    'digital_delivery_type' => $item['digital_delivery_type'] ?? $product->digital_delivery_type,
                    'digital_content_type' => $item['digital_content_type'] ?? $product->digital_content_type,
                    'service_location_type' => $item['service_location_type'] ?? $product->service_location_type,
                ];
            })->values()->all());
        }

        return Inertia::render('Chat', [
            'orderId' => $orderModel->id,
            'publicId' => $orderModel->public_id,
            'orderStatus' => $orderModel->payment_status,
            'orderFlow' => $orderFlow,
            'initialMessages' => $orderModel->messages,
            'orderTotal' => (float) $orderModel->total_paid,
            'actingAs' => $actingAs,
            'order' => $orderModel,
        ]);
    });

    // ─── MERCHANT DASHBOARD PAGES ─────────────────────────────────────────────
    // All merchant page routes are scoped to /merchant/{merchant} where {merchant}
    // is resolved via Merchant::getRouteKeyName() = 'username'. The own_merchant
    // middleware ensures the logged-in user owns that merchant profile.
    Route::prefix('merchant/{merchant}')->middleware('own_merchant')->group(function () {

        Route::get('/dashboard', function (Merchant $merchant) {
            Session::put('active_merchant_id', $merchant->id);
            return redirect('/profile');
        });

        Route::get('/pulse', function (Merchant $merchant) {
            return Inertia::render('Merchant/Pulse', [
                'merchant' => [
                    'id' => $merchant->id,
                    'username' => $merchant->username,
                    'display_name' => $merchant->display_name,
                ],
            ]);
        })->middleware('merchant_permission:dashboard.view')->name('merchant.pulse');
        Route::get('/pulse/api', [EntitlementController::class, 'merchantPulse'])->middleware('merchant_permission:dashboard.view');

        Route::get('/overview', function (Merchant $merchant) {
            return Inertia::render('Merchant/Overview', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:dashboard.view,orders.view,bookkeeping.view');
        Route::get('/overview/api', [MerchantBusinessOverviewController::class, 'show'])->middleware('merchant_permission:dashboard.view,orders.view,bookkeeping.view');

        Route::get('/settings', [MerchantProfileController::class, 'edit'])->middleware('merchant_permission:settings.view')->name('merchant.settings.edit');
        Route::post('/settings', [MerchantProfileController::class, 'update'])->middleware('merchant_permission:settings.update')->name('merchant.settings.update');
        Route::get('/modules', function (Merchant $merchant) {
            return Inertia::render('Merchant/Modules', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:settings.view');

        Route::get('/offering-groups', function (Merchant $merchant) {
            return Inertia::render('Merchant/OfferingGroups', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:products.view,services.view,bundles.view,subscriptions.view');

        Route::get('/upload', function (Merchant $merchant) {
            abort_unless($merchant->canSellProducts(), 403, 'Complete KYC before uploading products.');
            $merchant->loadMissing(['country', 'locations']);
            $merchantTimezone = $merchant->defaultTimezone();
            $countryTimezones = $merchant->country?->timezones() ?? [];
            $timezoneOptions = array_values(array_unique(array_filter([
                $merchantTimezone,
                ...$countryTimezones,
                ...timezone_identifiers_list(),
            ])));

            return Inertia::render('Merchant/Upload', [
                'merchantUsername' => $merchant->username,
                'merchantTimezone' => $merchantTimezone,
                'timezoneOptions' => $timezoneOptions,
                'merchantLocations' => $merchant->locations->map(fn ($location) => [
                    'id' => $location->id,
                    'name' => $location->name,
                    'address' => $location->address,
                    'latitude' => $location->latitude !== null ? (float) $location->latitude : null,
                    'longitude' => $location->longitude !== null ? (float) $location->longitude : null,
                    'is_primary' => (bool) $location->is_primary,
                    'allow_self_pickup' => (bool) $location->allow_self_pickup,
                    'contact_phone' => $location->contact_phone,
                    'type' => $location->type,
                ])->values(),
            ]);
        })->middleware('merchant_permission:products.create,digital_products.create,services.create');

        Route::get('/products', function (Request $request, Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'physical',
            ]);
        })->middleware('merchant_permission:products.view');

        Route::get('/menu', function (Request $request, Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['menu', 'products'], ['food_menu', 'physical_products']), 404);

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'physical',
                'moduleScope' => 'menu',
            ]);
        })->middleware('merchant_permission:products.view');

        Route::get('/products/{productId}', function (Merchant $merchant, int $productId) {
            return Inertia::render('Merchant/ProductDetails', [
                'merchantUsername' => $merchant->username,
                'productId' => $productId,
            ]);
        })->whereNumber('productId')->middleware('merchant_permission:products.view,digital_products.view,services.view');

        Route::get('/posts', function (Merchant $merchant) {
            return Inertia::render('Merchant/Posts', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:posts.view');

        Route::get('/bundles', function (Merchant $merchant) {
            return Inertia::render('Merchant/Bundles', [
                'merchantUsername' => $merchant->username,
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
            ]);
        })->middleware('merchant_permission:bundles.view');

        Route::get('/courses', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['courses', 'workshops', 'enrollments'], ['courses_learning']), 404);

            return Inertia::render('Merchant/Bundles', [
                'merchantUsername' => $merchant->username,
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
                'moduleScope' => 'courses',
            ]);
        })->middleware('merchant_permission:bundles.view');

        Route::get('/enrollments', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['enrollments', 'courses', 'workshops'], ['courses_learning']), 404);

            return Inertia::render('Merchant/Enrollments', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:bundles.manage_course,orders.view');

        Route::get('/bundles/{bundle:id}/course', function (Merchant $merchant, Bundle $bundle) {
            abort_unless((int) $bundle->merchant_id === (int) $merchant->id && $bundle->is_course, 404);

            return Inertia::render('Merchant/CourseManager', [
                'merchantUsername' => $merchant->username,
                'bundleId' => $bundle->id,
            ]);
        })->middleware('merchant_permission:bundles.manage_course');

        Route::get('/subscriptions', function (Merchant $merchant) {
            return Inertia::render('Merchant/Subscriptions', [
                'merchantUsername' => $merchant->username,
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
            ]);
        })->middleware('merchant_permission:subscriptions.view');
        Route::get('/subscription-members', function (Merchant $merchant) {
            return Inertia::render('Merchant/SubscriptionMembers', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
            ]);
        })->middleware('merchant_permission:subscriptions.manage_members');
        Route::get('/subscription-plans/{subscriptionPlan:id}/members', function (Merchant $merchant, SubscriptionPlan $subscriptionPlan) {
            abort_unless((int) $subscriptionPlan->merchant_id === (int) $merchant->id, 404);

            return Inertia::render('Merchant/SubscriptionMembers', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'subscriptionPlanId' => $subscriptionPlan->id,
                'subscriptionPlanName' => $subscriptionPlan->name,
            ]);
        })->middleware('merchant_permission:subscriptions.manage_members');

        Route::get('/marketing', function (Merchant $merchant) {
            return Inertia::render('Merchant/Marketing', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'section' => 'overview',
            ]);
        })->middleware('merchant_permission:marketing.view');
        Route::get('/marketing/{section}', function (Merchant $merchant, string $section) {
            abort_unless(in_array($section, ['coupons', 'sms', 'referrals', 'group-sales', 'social-dms', 'whatsapp', 'analytics'], true), 404);

            return Inertia::render('Merchant/Marketing', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'section' => $section,
            ]);
        })->where('section', 'coupons|sms|referrals|group-sales|social-dms|whatsapp|analytics')->middleware('merchant_permission:marketing.view');

        Route::get('/services', function (Merchant $merchant) {
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/rooms', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['rooms', 'bookings', 'services'], ['services_bookings']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'rooms',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/tours', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['tour_departures', 'bookings', 'services'], ['services_bookings', 'custom_orders_quotes']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'tour_departures',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/custom-orders', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['custom_orders', 'quotes', 'services'], ['custom_orders_quotes']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'custom_orders',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/appointments', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['appointments', 'bookings', 'services'], ['services_bookings']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'appointments',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/reservations', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['reservations', 'bookings', 'services'], ['services_bookings', 'food_menu']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'reservations',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/rentals', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['rentals', 'bookings', 'services'], ['services_bookings', 'custom_orders_quotes']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'rentals',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/workshops', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea(['workshops', 'bookings', 'services'], ['courses_learning', 'services_bookings']), 404);
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'moduleScope' => 'workshops',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view');

        Route::get('/bookings', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea([
                'bookings', 'availability', 'appointments', 'reservations', 'rentals', 'rooms', 'tour_departures', 'workshops', 'services',
            ], ['services_bookings', 'food_menu', 'courses_learning']), 404);

            return Inertia::render('Merchant/BookingCalendar', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:services.view,services.schedule');

        Route::get('/availability', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea([
                'availability', 'bookings', 'appointments', 'reservations', 'rentals', 'rooms', 'tour_departures', 'workshops', 'services',
            ], ['services_bookings', 'food_menu', 'courses_learning']), 404);

            return Inertia::render('Merchant/Availability', [
                'merchantUsername' => $merchant->username,
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        })->middleware('merchant_permission:services.view,services.schedule');

        Route::get('/downloads', function (Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'digital',
            ]);
        })->middleware('merchant_permission:digital_products.view');

        Route::get('/orders', function (Merchant $merchant) {
            return Inertia::render('Merchant/Orders', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
            ]);
        })->middleware('merchant_permission:orders.view');

        Route::get('/customers', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea([
                'customers', 'orders', 'services', 'bookings', 'courses', 'enrollments', 'subscriptions', 'marketing', 'retail_ops',
            ], ['physical_products', 'food_menu', 'digital_products', 'services_bookings', 'courses_learning', 'subscriptions_memberships', 'custom_orders_quotes']), 404);

            return Inertia::render('Merchant/Customers', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:orders.view,marketing.view,retail.customers');

        Route::get('/communications', function (Merchant $merchant) {
            abort_unless($merchant->supportsBusinessArea([
                'communications', 'customers', 'marketing', 'orders', 'services', 'bookings', 'enrollments', 'subscriptions', 'retail_ops',
            ], ['physical_products', 'food_menu', 'digital_products', 'services_bookings', 'courses_learning', 'subscriptions_memberships', 'custom_orders_quotes']), 404);

            return Inertia::render('Merchant/Communications', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:marketing.view,orders.view,services.view');

        Route::get('/team', function (Merchant $merchant) {
            abort_unless($merchant->hasModule('team') || $merchant->hasModule('retail_ops'), 404);

            return Inertia::render('Merchant/Team', [
                'merchant' => $merchant->load('currency'),
            ]);
        })->middleware('merchant_permission:team.view');

        Route::get('/wallet', [\App\Http\Controllers\Api\MerchantWalletController::class, 'show'])->middleware('merchant_permission:wallet.view')->name('merchant.wallet');
        Route::get('/wallet/ledger', [\App\Http\Controllers\Api\MerchantWalletController::class, 'showLedger'])->middleware('merchant_permission:wallet.ledger')->name('merchant.wallet.ledger');
        Route::post('/wallet/withdraw', [\App\Http\Controllers\Api\MerchantWalletController::class, 'requestWithdrawal'])->middleware('merchant_permission:wallet.withdraw')->name('merchant.wallet.withdraw');
        Route::get('/platform-subscriptions/retail-operations', function (Merchant $merchant) {
            abort_unless($merchant->isRetailEligible(), 403, 'Retail Operations is only available for verified business accounts with completed business KYC.');

            if ((string) \App\Models\AdminSetting::get('retail_access_mode', 'free') === 'free') {
                if (! $merchant->hasModule('retail_ops')) {
                    $modules = $merchant->active_modules ?? [];
                    $modules[] = 'retail_ops';
                    $merchant->forceFill(['active_modules' => array_values(array_unique($modules))])->save();
                }

                return redirect("/merchant/{$merchant->username}/retail/dashboard");
            }

            return Inertia::render('Merchant/PlatformSubscription', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'featureKey' => 'retail_ops',
            ]);
        })->middleware('merchant_permission:settings.update')->name('merchant.platform-subscriptions.retail-operations');
        Route::get('/platform-subscriptions/storage', function (Merchant $merchant) {
            return Inertia::render('Merchant/PlatformSubscription', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'featureKey' => 'storage',
            ]);
        })->middleware('merchant_permission:settings.update')->name('merchant.platform-subscriptions.storage');
        Route::get('/platform-subscriptions/api', [MerchantPlatformSubscriptionController::class, 'index'])->middleware('merchant_permission:settings.view');
        Route::post('/platform-subscriptions/trial', [MerchantPlatformSubscriptionController::class, 'startTrial'])->middleware('merchant_permission:settings.update');
        Route::post('/platform-subscriptions/simulate-payment', [MerchantPlatformSubscriptionController::class, 'simulatePayment'])->middleware('merchant_permission:settings.update');

        // ── Merchant-scoped API endpoints (still session-scoped internally) ──
        Route::get('/products/api', [UploadController::class, 'index'])->middleware('merchant_permission:products.view,digital_products.view,services.view');
        Route::get('/products/{id}/api', [UploadController::class, 'show'])->whereNumber('id')->middleware('merchant_permission:products.view,digital_products.view,services.view');
        Route::delete('/products/{id}', [UploadController::class, 'deleteProduct'])->whereNumber('id')->middleware('merchant_permission:products.delete,digital_products.delete,services.delete');
        Route::post('/products/{product}/hotspots', [UploadController::class, 'syncHotspots'])->whereNumber('product')->middleware('merchant_permission:products.update,digital_products.update,services.update');
        Route::post('/products/{product}/media', [UploadController::class, 'syncDraftMedia'])->whereNumber('product')->middleware('merchant_permission:products.update,digital_products.update,services.update');
        Route::get('/products/{product:id}/releases', [\App\Http\Controllers\Api\ProductReleaseController::class, 'index'])->middleware('merchant_permission:digital_products.view');
        Route::post('/products/{product:id}/releases', [\App\Http\Controllers\Api\ProductReleaseController::class, 'store'])->middleware('merchant_permission:digital_products.update');
        Route::patch('/products/{product:id}/releases/{release:id}', [\App\Http\Controllers\Api\ProductReleaseController::class, 'update'])->middleware('merchant_permission:digital_products.update');
        Route::delete('/products/{product:id}/releases/{release:id}', [\App\Http\Controllers\Api\ProductReleaseController::class, 'destroy'])->middleware('merchant_permission:digital_products.delete');
        Route::get('/products/{product:id}/license-keys', [\App\Http\Controllers\Api\ProductLicenseKeyController::class, 'index'])->middleware('merchant_permission:digital_products.manage_keys');
        Route::post('/products/{product:id}/license-keys/{license:id}/revoke', [\App\Http\Controllers\Api\ProductLicenseKeyController::class, 'revoke'])->middleware('merchant_permission:digital_products.manage_keys');
        Route::post('/products/{product:id}/license-keys/{license:id}/regenerate', [\App\Http\Controllers\Api\ProductLicenseKeyController::class, 'regenerate'])->middleware('merchant_permission:digital_products.manage_keys');
        Route::get('/products/{product:id}/live-event', [\App\Http\Controllers\Api\LiveEventController::class, 'dashboard']);
        Route::put('/products/{product:id}/live-event', [\App\Http\Controllers\Api\LiveEventController::class, 'update']);
        Route::post('/products/{product:id}/live-event/orders/{order:id}/attendance', [\App\Http\Controllers\Api\LiveEventController::class, 'markAttendance']);
        Route::post('/products/{product:id}/live-event/orders/{order:id}/resend-access', [\App\Http\Controllers\Api\LiveEventController::class, 'resendAccess']);
        Route::post('/upload/media', [UploadController::class, 'uploadMedia'])->middleware('merchant_permission:products.create,digital_products.create,services.create');
        Route::post('/upload/draft', [UploadController::class, 'draftProduct'])->middleware('merchant_permission:products.create,digital_products.create,services.create');
        Route::post('/upload/manual', [UploadController::class, 'manualDraft'])->middleware('merchant_permission:products.create,digital_products.create,services.create');
        Route::post('/upload/publish', [UploadController::class, 'publishProduct'])->middleware('merchant_permission:products.publish,digital_products.publish,services.create');
        Route::get('/catalog/schema', [UploadController::class, 'catalogSchema']);
        Route::post('/posts', [PostController::class, 'store'])->middleware('merchant_permission:posts.create,posts.publish');
        Route::delete('/posts/{post}', [PostController::class, 'destroy'])->middleware('merchant_permission:posts.delete');

        Route::get('/content-items/api', [MerchantContentController::class, 'index'])->middleware('merchant_permission:digital_products.view');
        Route::post('/content-items/api', [MerchantContentController::class, 'store'])->middleware('merchant_permission:digital_products.create');
        Route::get('/content-items/{contentItem:id}/api', [MerchantContentController::class, 'show'])->middleware('merchant_permission:digital_products.view');
        Route::put('/content-items/{contentItem:id}/api', [MerchantContentController::class, 'update'])->middleware('merchant_permission:digital_products.update');
        Route::delete('/content-items/{contentItem:id}/api', [MerchantContentController::class, 'destroy'])->middleware('merchant_permission:digital_products.delete');
        Route::get('/posts/api', [MerchantContentController::class, 'posts'])->middleware('merchant_permission:posts.view');
        Route::patch('/posts/{post:id}/interaction/api', [MerchantContentController::class, 'updatePostInteraction'])->middleware('merchant_permission:posts.update');
        Route::get('/content-reports/api', [ContentReportModerationController::class, 'merchantIndex'])->middleware('merchant_permission:posts.view');
        Route::patch('/content-reports/{contentReport:id}/resolve/api', [ContentReportModerationController::class, 'merchantResolve'])->middleware('merchant_permission:posts.update');
        Route::post('/content-reports/{contentReport:id}/appeal/api', [ContentReportModerationController::class, 'merchantAppeal'])->middleware('merchant_permission:posts.update');

        Route::get('/bundles/api', fn (Request $request, Merchant $merchant, MerchantBundleController $controller) => $controller->index($request))->middleware('merchant_permission:bundles.view');
        Route::post('/bundles/api', fn (Request $request, Merchant $merchant, MerchantBundleController $controller, EntitlementService $entitlementService) => $controller->store($request, $entitlementService))->middleware('merchant_permission:bundles.create');
        Route::get('/bundles/{bundle:id}/api', fn (Request $request, Merchant $merchant, Bundle $bundle, MerchantBundleController $controller) => $controller->show($request, $bundle))->middleware('merchant_permission:bundles.view');
        Route::put('/bundles/{bundle:id}/api', fn (Request $request, Merchant $merchant, Bundle $bundle, MerchantBundleController $controller, EntitlementService $entitlementService) => $controller->update($request, $bundle, $entitlementService))->middleware('merchant_permission:bundles.update');
        Route::delete('/bundles/{bundle:id}/api', fn (Request $request, Merchant $merchant, Bundle $bundle, MerchantBundleController $controller) => $controller->destroy($request, $bundle))->middleware('merchant_permission:bundles.delete');
        Route::get('/enrollments/api', [MerchantCourseController::class, 'enrollments'])->middleware('merchant_permission:bundles.manage_course,orders.view');
        Route::get('/bundles/{bundle:id}/course/api', [MerchantCourseController::class, 'dashboard'])->middleware('merchant_permission:bundles.manage_course');
        Route::post('/bundles/{bundle:id}/course/sessions/{session:id}/check-in-code', [MerchantCourseController::class, 'generateCheckInCode'])->middleware('merchant_permission:bundles.manage_course');
        Route::post('/bundles/{bundle:id}/course/sessions/{session:id}/attendance', [MerchantCourseController::class, 'markAttendance'])->middleware('merchant_permission:bundles.manage_course');

        Route::get('/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'index'])->middleware('merchant_permission:subscriptions.view');
        Route::post('/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'store'])->middleware('merchant_permission:subscriptions.create');
        Route::get('/subscription-members/api', [MerchantSubscriptionPlanController::class, 'merchantMembers'])->middleware('merchant_permission:subscriptions.manage_members');
        Route::get('/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'show'])->middleware('merchant_permission:subscriptions.view');
        Route::put('/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'update'])->middleware('merchant_permission:subscriptions.update');
        Route::delete('/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'destroy'])->middleware('merchant_permission:subscriptions.delete');
        Route::get('/subscription-plans/{subscriptionPlan:id}/members/api', [MerchantSubscriptionPlanController::class, 'members'])->middleware('merchant_permission:subscriptions.manage_members');
        Route::patch('/subscription-plans/{subscriptionPlan:id}/members/{userSubscription:id}/api', [MerchantSubscriptionPlanController::class, 'updateMember'])->middleware('merchant_permission:subscriptions.manage_members');
        Route::get('/subscription-plans/{subscriptionPlan:id}/community-posts/api', [MerchantSubscriptionPlanController::class, 'communityPosts'])->middleware('merchant_permission:subscriptions.view');
        Route::post('/subscription-plans/{subscriptionPlan:id}/community-posts/api', [MerchantSubscriptionPlanController::class, 'storeCommunityPost'])->middleware('merchant_permission:subscriptions.update');
        Route::delete('/subscription-plans/{subscriptionPlan:id}/community-posts/{post:id}/api', [MerchantSubscriptionPlanController::class, 'destroyCommunityPost'])->middleware('merchant_permission:subscriptions.update');

        Route::get('/marketing/api', [MerchantMarketingController::class, 'index'])->middleware('merchant_permission:marketing.view');
        Route::post('/marketing/coupons/api', [MerchantMarketingController::class, 'store'])->middleware('merchant_permission:marketing.create');
        Route::put('/marketing/coupons/{coupon:id}/api', [MerchantMarketingController::class, 'update'])->middleware('merchant_permission:marketing.update');
        Route::delete('/marketing/coupons/{coupon:id}/api', [MerchantMarketingController::class, 'destroy'])->middleware('merchant_permission:marketing.delete');
        Route::post('/marketing/sms/packages/api', [MerchantMarketingController::class, 'buySmsPackage'])->middleware('merchant_permission:marketing.send_sms');
        Route::post('/marketing/sms/estimate/api', [MerchantMarketingController::class, 'estimateSmsAudience'])->middleware('merchant_permission:marketing.send_sms');
        Route::post('/marketing/sms/campaigns/api', [MerchantMarketingController::class, 'storeSmsCampaign'])->middleware('merchant_permission:marketing.send_sms');
        Route::put('/marketing/abandoned-checkout-automation/api', [MerchantMarketingController::class, 'updateAbandonedCheckoutAutomation'])->middleware('merchant_permission:marketing.send_sms,marketing.update');
        Route::post('/marketing/referrals/api', [MerchantMarketingController::class, 'storeReferral'])->middleware('merchant_permission:marketing.create');
        Route::put('/marketing/referrals/{referralLink:id}/api', [MerchantMarketingController::class, 'updateReferral'])->middleware('merchant_permission:marketing.update');
        Route::delete('/marketing/referrals/{referralLink:id}/api', [MerchantMarketingController::class, 'destroyReferral'])->middleware('merchant_permission:marketing.delete');
        Route::post('/marketing/referrals/{referralLink:id}/commissions/api', [MerchantMarketingController::class, 'payReferralCommissions'])->middleware('merchant_permission:marketing.update');
        Route::get('/marketing/social-accounts/meta/connect', [MerchantMarketingController::class, 'startMetaConnection'])->middleware('merchant_permission:marketing.connect_channels');
        Route::post('/marketing/social-accounts/api', [MerchantMarketingController::class, 'connectSocialAccount'])->middleware('merchant_permission:marketing.connect_channels');
        Route::get('/marketing/social-accounts/{socialAccount:id}/media/api', [MerchantMarketingController::class, 'importSocialMedia'])->middleware('merchant_permission:marketing.connect_channels');
        Route::post('/marketing/social-dms/api', [MerchantMarketingController::class, 'storeSocialDmCampaign'])->middleware('merchant_permission:marketing.create');
        Route::put('/marketing/social-dms/{socialDmCampaign:id}/api', [MerchantMarketingController::class, 'updateSocialDmCampaign'])->middleware('merchant_permission:marketing.update');
        Route::delete('/marketing/social-dms/{socialDmCampaign:id}/api', [MerchantMarketingController::class, 'destroySocialDmCampaign'])->middleware('merchant_permission:marketing.delete');
        Route::post('/marketing/social-dms/simulate-comment/api', [MerchantMarketingController::class, 'simulateSocialDmComment'])->middleware('merchant_permission:marketing.view');
        Route::post('/marketing/whatsapp/accounts/api', [MerchantMarketingController::class, 'connectWhatsappAccount'])->middleware('merchant_permission:marketing.connect_channels');
        Route::post('/marketing/whatsapp/embedded-signup/api', [MerchantMarketingController::class, 'completeWhatsappEmbeddedSignup'])->middleware('merchant_permission:marketing.connect_channels');
        Route::post('/marketing/whatsapp/automations/api', [MerchantMarketingController::class, 'storeWhatsappAutomation'])->middleware('merchant_permission:marketing.create');
        Route::put('/marketing/whatsapp/automations/{whatsappAutomation:id}/api', [MerchantMarketingController::class, 'updateWhatsappAutomation'])->middleware('merchant_permission:marketing.update');
        Route::delete('/marketing/whatsapp/automations/{whatsappAutomation:id}/api', [MerchantMarketingController::class, 'destroyWhatsappAutomation'])->middleware('merchant_permission:marketing.delete');
        Route::post('/marketing/whatsapp/simulate-message/api', [MerchantMarketingController::class, 'simulateWhatsappMessage'])->middleware('merchant_permission:marketing.view');
        Route::post('/marketing/group-sales/api', [MerchantMarketingController::class, 'storeGroupSale'])->middleware('merchant_permission:marketing.create');
        Route::put('/marketing/group-sales/{groupSale:id}/api', [MerchantMarketingController::class, 'updateGroupSale'])->middleware('merchant_permission:marketing.update');
        Route::delete('/marketing/group-sales/{groupSale:id}/api', [MerchantMarketingController::class, 'destroyGroupSale'])->middleware('merchant_permission:marketing.delete');
        Route::get('/exports/orders.csv', [MerchantAnalyticsExportController::class, 'orders'])->middleware('merchant_permission:marketing.view');
        Route::get('/exports/statement.csv', [MerchantAnalyticsExportController::class, 'statement'])->middleware('merchant_permission:marketing.view');
        Route::get('/exports/product-performance.csv', [MerchantAnalyticsExportController::class, 'productPerformance'])->middleware('merchant_permission:marketing.view');
        Route::get('/exports/campaigns.csv', [MerchantAnalyticsExportController::class, 'campaigns'])->middleware('merchant_permission:marketing.view');

        Route::get('/orders/api', [MerchantOrderController::class, 'index'])->middleware('merchant_permission:orders.view');
        Route::get('/orders/api/summary', [MerchantOrderController::class, 'summary'])->middleware('merchant_permission:orders.view');
        Route::get('/orders/api/commerce-summary', [MerchantOrderController::class, 'commerceSummary'])->middleware('merchant_permission:dashboard.view,orders.view');
        Route::get('/modules/api', [MerchantModuleSetupController::class, 'show'])->middleware('merchant_permission:settings.view');
        Route::put('/modules/api', [MerchantModuleSetupController::class, 'update'])->middleware('merchant_permission:settings.update');
        Route::get('/customers/api', [MerchantCustomerController::class, 'crm'])->middleware('merchant_permission:orders.view,marketing.view,retail.customers');
        Route::get('/communications/api', [MerchantCommunicationController::class, 'index'])->middleware('merchant_permission:marketing.view,orders.view,services.view');
        Route::post('/communications/api', [MerchantCommunicationController::class, 'store'])->middleware('merchant_permission:marketing.update,orders.update,services.update');
        Route::get('/team/api', [MerchantStaffController::class, 'index'])->middleware('merchant_permission:team.view');
        Route::post('/team/api', [MerchantStaffController::class, 'store'])->middleware('merchant_permission:team.create');
        Route::patch('/team/{staff:id}/api', [MerchantStaffController::class, 'update'])->middleware('merchant_permission:team.update');
        Route::patch('/team/{staff:id}/reset-pin/api', [MerchantStaffController::class, 'resetPin'])->middleware('merchant_permission:team.reset_pin');
        Route::post('/team/{staff:id}/clear-devices/api', [MerchantStaffController::class, 'clearDevices'])->middleware('merchant_permission:team.clear_devices');
        Route::delete('/team/{staff:id}/api', [MerchantStaffController::class, 'destroy'])->middleware('merchant_permission:team.delete');
        Route::get('/service-requests/api', [ServiceRequestController::class, 'merchantIndex'])->middleware('merchant_permission:services.view,orders.view');
        Route::get('/service-requests/{serviceRequest}/attachments/{field}/{index}', [ServiceRequestController::class, 'showAttachment'])->where('field', '[^/]+')->whereNumber('index')->middleware('merchant_permission:services.view,orders.view');
        Route::patch('/service-requests/{serviceRequest}/status', [ServiceRequestController::class, 'updateStatus'])->middleware('merchant_permission:services.update,orders.update');
        Route::patch('/service-requests/{serviceRequest}/fulfillment', [ServiceRequestController::class, 'updateFulfillment'])->middleware('merchant_permission:services.update,orders.update');
        Route::post('/service-requests/{serviceRequest}/mark-delivered', [ServiceRequestController::class, 'markDelivered'])->middleware('merchant_permission:services.update,orders.update');
        Route::post('/service-requests/{serviceRequest}/prepare-notification', [ServiceRequestController::class, 'prepareNotification'])->middleware('merchant_permission:services.update,orders.update');
        Route::post('/service-requests/{serviceRequest}/prepare-calendar-event', [ServiceRequestController::class, 'prepareCalendarEvent'])->middleware('merchant_permission:services.schedule');
        Route::get('/booking-calendar/api', [ServiceRequestController::class, 'calendar'])->middleware('merchant_permission:services.view,services.schedule');
        Route::get('/service-scheduling/api', [ServiceRequestController::class, 'scheduling'])->middleware('merchant_permission:services.view,services.schedule');
        Route::put('/service-scheduling/api', [ServiceRequestController::class, 'updateScheduling'])->middleware('merchant_permission:services.schedule');
        Route::get('/service-sessions/api', [ServiceRequestController::class, 'sessions'])->middleware('merchant_permission:services.view,services.schedule');
        Route::put('/service-sessions/api', [ServiceRequestController::class, 'updateSessions'])->middleware('merchant_permission:services.schedule');
        Route::get('/orders/{order}/api', [MerchantOrderController::class, 'show'])->middleware('merchant_permission:orders.view');
        Route::post('/orders/{order}/custom-delivery', [MerchantOrderController::class, 'uploadCustomDelivery'])->middleware('merchant_permission:orders.dispatch');
        Route::post('/orders/{order}/rider-access', [MerchantOrderController::class, 'generateRiderAccess'])->middleware('merchant_permission:orders.dispatch,orders.update');
        Route::post('/orders/{order}/delivery-status', [MerchantOrderController::class, 'updateDeliveryStatus'])->middleware('merchant_permission:orders.dispatch,orders.update');
        Route::post('/orders/{order}/return-request/approve', [MerchantOrderController::class, 'approveReturn'])->middleware('merchant_permission:orders.update');
        Route::post('/orders/{order}/return-request/reject', [MerchantOrderController::class, 'rejectReturn'])->middleware('merchant_permission:orders.update');
        Route::post('/orders/{order}/return-request/received', [MerchantOrderController::class, 'markReturnReceived'])->middleware('merchant_permission:orders.update');
        Route::post('/orders/{order}/return-request/complete', [MerchantOrderController::class, 'completeReturn'])->middleware('merchant_permission:orders.update');
        Route::post('/dispatch/{order}/intercity', [DispatchController::class, 'intercity'])->middleware('merchant_permission:orders.dispatch');
        Route::post('/dispatch/{order}/local', [DispatchController::class, 'local'])->middleware('merchant_permission:orders.dispatch');
        Route::get('/orders/{order}', function (Merchant $merchant, \App\Models\Order $order) {
            abort_unless($order->merchant_id === $merchant->id, 404);

            return Inertia::render('Merchant/OrderDetails', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'orderId' => $order->id,
            ]);
        })->middleware('merchant_permission:orders.view');
        Route::get('/wallet/api/history', [\App\Http\Controllers\Api\MerchantWalletController::class, 'history'])->middleware('merchant_permission:wallet.view,wallet.ledger');
        
        // KYC endpoints
        Route::get('/kyc/api', [\App\Http\Controllers\Api\MerchantKycController::class, 'show'])->middleware('merchant_permission:kyc.view');
        Route::post('/kyc/api', [\App\Http\Controllers\Api\MerchantKycController::class, 'store'])->middleware('merchant_permission:kyc.update');
        Route::get('/service-credentials/api', [\App\Http\Controllers\Api\MerchantServiceCredentialController::class, 'index'])->middleware('merchant_permission:kyc.view');
        Route::post('/service-credentials/api', [\App\Http\Controllers\Api\MerchantServiceCredentialController::class, 'store'])->middleware('merchant_permission:kyc.update');
        Route::delete('/service-credentials/api/{credential}', [\App\Http\Controllers\Api\MerchantServiceCredentialController::class, 'destroy'])->middleware('merchant_permission:kyc.update');
        
        Route::get('/verification', function (Merchant $merchant) {
            return Inertia::render('Merchant/VerificationCenter', [
                'merchantUsername' => $merchant->username,
            ]);
        })->middleware('merchant_permission:kyc.view');

        // ── RETAIL OPS PAGES ──
        Route::middleware('retail_ops')->prefix('retail')->group(function () {
            Route::get('/dashboard', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Dashboard', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('merchant_permission:retail.dashboard');

            Route::get('/trust-safety', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/TrustSafety', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('merchant_permission:retail.settings,settings.view');

            Route::get('/bookkeeping', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Bookkeeping', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('merchant_permission:bookkeeping.view');

            Route::get('/staff', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Staff', ['merchant' => $merchant]);
            })->middleware('merchant_permission:team.view');
            Route::get('/customers', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Customers', ['merchant' => $merchant]);
            })->middleware('merchant_permission:retail.customers');
            Route::get('/outstanding', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Outstanding', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('merchant_permission:retail.outstanding');
            Route::get('/transfers', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Transfers', ['merchant' => $merchant]);
            })->middleware('merchant_permission:retail.transfers');
            Route::get('/products/{product:id}/timeline', function (Merchant $merchant, \App\Models\Product $product) {
                abort_unless((int) $product->merchant_id === (int) $merchant->id, 404);
                return Inertia::render('Merchant/Retail/ProductTimeline', [
                    'merchant' => $merchant->load('currency'),
                    'productId' => $product->id,
                ]);
            })->middleware('merchant_permission:retail.inventory');
            Route::get('/inventory', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Inventory', ['merchant' => $merchant->load('currency')]);
            })->middleware('merchant_permission:retail.inventory');
            Route::get('/storekeeper', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Storekeeper', ['merchant' => $merchant]);
            })->middleware('merchant_permission:retail.inventory,retail.pos');

            Route::get('/settings', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Settings', ['merchant' => $merchant]);
            })->middleware('merchant_permission:retail.settings');

            Route::get('/pos', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/PosTerminal', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('merchant_permission:retail.pos');

            Route::get('/onboarding/template', [\App\Http\Controllers\Api\RetailOnboardingController::class, 'downloadTemplate'])->middleware('merchant_permission:retail.inventory');
        });
    });

    // Legacy redirect: /merchant/dashboard → resolve user's default merchant
    Route::get('/merchant/dashboard', function (Request $request) {
        $merchant = $request->user()->merchantProfiles()->where('is_default', true)->first()
            ?? $request->user()->merchantProfiles()->first();
            
        if (!$merchant) return redirect('/profile');
        
        Session::put('active_merchant_id', $merchant->id);
        return redirect('/profile');
    });

    Route::middleware('merchant_status')->group(function () {
        // File handling & Product Management
        Route::get('/merchant/products/api', [UploadController::class, 'index'])->middleware('merchant_permission:products.view,digital_products.view,services.view');
        Route::get('/merchant/products/{id}/api', [UploadController::class, 'show'])->middleware('merchant_permission:products.view,digital_products.view,services.view');
        Route::delete('/merchant/products/{id}', [UploadController::class, 'deleteProduct'])->middleware('merchant_permission:products.delete,digital_products.delete,services.delete');
        Route::post('/merchant/products/{product}/media', [UploadController::class, 'syncDraftMedia'])->middleware('merchant_permission:products.update,digital_products.update,services.update');
        Route::post('/merchant/upload/media', [UploadController::class, 'uploadMedia'])->middleware('merchant_permission:products.create,digital_products.create,services.create');
        Route::post('/merchant/upload/draft', [UploadController::class, 'draftProduct'])->middleware('merchant_permission:products.create,digital_products.create,services.create');
        Route::post('/merchant/upload/manual', [UploadController::class, 'manualDraft'])->middleware('merchant_permission:products.create,digital_products.create,services.create');
        Route::post('/merchant/upload/publish', [UploadController::class, 'publishProduct'])->middleware('merchant_permission:products.publish,digital_products.publish,services.create');
        Route::get('/merchant/catalog/schema', [UploadController::class, 'catalogSchema']);
        Route::post('/merchant/products/{product}/hotspots', [UploadController::class, 'syncHotspots'])->middleware('merchant_permission:products.update,digital_products.update,services.update');
        Route::post('/merchant/posts', [PostController::class, 'store'])->middleware('merchant_permission:posts.create,posts.publish');
        Route::delete('/merchant/posts/{post}', [PostController::class, 'destroy'])->middleware('merchant_permission:posts.delete');

        // Commerce management (session-auth web endpoints)
        Route::get('/merchant/content-items/api', [MerchantContentController::class, 'index'])->middleware('merchant_permission:digital_products.view');
        Route::post('/merchant/content-items/api', [MerchantContentController::class, 'store'])->middleware('merchant_permission:digital_products.create');
        Route::get('/merchant/content-items/{contentItem:id}/api', [MerchantContentController::class, 'show'])->middleware('merchant_permission:digital_products.view');
        Route::put('/merchant/content-items/{contentItem:id}/api', [MerchantContentController::class, 'update'])->middleware('merchant_permission:digital_products.update');
        Route::delete('/merchant/content-items/{contentItem:id}/api', [MerchantContentController::class, 'destroy'])->middleware('merchant_permission:digital_products.delete');
        Route::get('/merchant/posts/api', [MerchantContentController::class, 'posts'])->middleware('merchant_permission:posts.view');
        Route::patch('/merchant/posts/{post:id}/interaction/api', [MerchantContentController::class, 'updatePostInteraction'])->middleware('merchant_permission:posts.update');
        Route::get('/merchant/content-reports/api', [ContentReportModerationController::class, 'merchantIndex'])->middleware('merchant_permission:posts.view');
        Route::patch('/merchant/content-reports/{contentReport:id}/resolve/api', [ContentReportModerationController::class, 'merchantResolve'])->middleware('merchant_permission:posts.update');
        Route::post('/merchant/content-reports/{contentReport:id}/appeal/api', [ContentReportModerationController::class, 'merchantAppeal'])->middleware('merchant_permission:posts.update');

        Route::get('/merchant/bundles/api', [MerchantBundleController::class, 'index'])->middleware('merchant_permission:bundles.view');
        Route::post('/merchant/bundles/api', [MerchantBundleController::class, 'store'])->middleware('merchant_permission:bundles.create');
        Route::get('/merchant/bundles/{bundle:id}/api', [MerchantBundleController::class, 'show'])->middleware('merchant_permission:bundles.view');
        Route::put('/merchant/bundles/{bundle:id}/api', [MerchantBundleController::class, 'update'])->middleware('merchant_permission:bundles.update');
        Route::delete('/merchant/bundles/{bundle:id}/api', [MerchantBundleController::class, 'destroy'])->middleware('merchant_permission:bundles.delete');

        Route::get('/merchant/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'index'])->middleware('merchant_permission:subscriptions.view');
        Route::post('/merchant/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'store'])->middleware('merchant_permission:subscriptions.create');
        Route::get('/merchant/subscription-plans/{plan:id}/api', [MerchantSubscriptionPlanController::class, 'show'])->middleware('merchant_permission:subscriptions.view');
        Route::put('/merchant/subscription-plans/{plan:id}/api', [MerchantSubscriptionPlanController::class, 'update'])->middleware('merchant_permission:subscriptions.update');
        Route::delete('/merchant/subscription-plans/{plan:id}/api', [MerchantSubscriptionPlanController::class, 'destroy'])->middleware('merchant_permission:subscriptions.delete');

        // Standalone Payment Pages
        Route::get('/merchant/{merchant:username}/payment-pages', [\App\Http\Controllers\Api\PaymentPageController::class, 'index'])->name('merchant.payment-pages.index');
        Route::get('/merchant/{merchant:username}/payment-pages/create', [\App\Http\Controllers\Api\PaymentPageController::class, 'create'])->name('merchant.payment-pages.create');
        Route::post('/merchant/{merchant:username}/payment-pages', [\App\Http\Controllers\Api\PaymentPageController::class, 'store'])->name('merchant.payment-pages.store');
        Route::get('/merchant/{merchant:username}/payment-pages/{paymentPage:id}/edit', [\App\Http\Controllers\Api\PaymentPageController::class, 'edit'])->name('merchant.payment-pages.edit');
        Route::put('/merchant/{merchant:username}/payment-pages/{paymentPage:id}', [\App\Http\Controllers\Api\PaymentPageController::class, 'update'])->name('merchant.payment-pages.update');
        Route::delete('/merchant/{merchant:username}/payment-pages/{paymentPage:id}', [\App\Http\Controllers\Api\PaymentPageController::class, 'destroy'])->name('merchant.payment-pages.destroy');
        Route::get('/merchant/{merchant:username}/payment-pages/api/search', [\App\Http\Controllers\Api\PaymentPageController::class, 'searchAttachables'])->name('merchant.payment-pages.search');
    });

});

Route::get('/m/{slug}', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant);

    return Inertia::render('MiniStore', [
        'merchantSlug' => $slug,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});
Route::get('/u/{slug}/catalog', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'catalog');

    return Inertia::render('PublicCatalog', [
        'merchantSlug' => $slug,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});
Route::get('/u/{slug}', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'profile');

    return Inertia::render('PublicMerchantProfile', [
        'merchantSlug' => $slug,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/feed', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'feed');

    return Inertia::render('MiniStoreFeed', [
        'merchantSlug' => $slug,
        'seo' => $seo,
    ])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/products', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'products');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'products', 'seo' => $seo])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/downloads', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'downloads');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'downloads', 'seo' => $seo])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/services', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'services');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'services', 'seo' => $seo])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/content', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'content');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'content', 'seo' => $seo])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/bundles', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'bundles');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'bundles', 'seo' => $seo])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/courses', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'courses');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'courses', 'seo' => $seo])->withViewData('seo', $seo);
});
Route::get('/m/{slug}/memberships', function (string $slug) {
    $merchant = Merchant::where('username', $slug)->firstOrFail();
    $seo = SeoMeta::merchant($merchant, 'memberships');

    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'memberships', 'seo' => $seo])->withViewData('seo', $seo);
});

Route::get('/sitemap.xml', function () {
    $urls = collect([
        url('/'),
        url('/feed'),
        url('/welcome'),
        route('search.page'),
        route('terms'),
        route('privacy'),
    ]);

    Merchant::query()
        ->where('is_active', true)
        ->select(['username', 'updated_at'])
        ->latest('updated_at')
        ->chunk(500, function ($merchants) use (&$urls) {
            foreach ($merchants as $merchant) {
                foreach ([
                    "/m/{$merchant->username}",
                    "/u/{$merchant->username}",
                    "/u/{$merchant->username}/catalog",
                    "/m/{$merchant->username}/products",
                    "/m/{$merchant->username}/downloads",
                    "/m/{$merchant->username}/services",
                    "/m/{$merchant->username}/content",
                    "/m/{$merchant->username}/bundles",
                    "/m/{$merchant->username}/courses",
                    "/m/{$merchant->username}/memberships",
                ] as $path) {
                    $urls->push(url($path));
                }
            }
        });

    Product::query()
        ->whereNull('deleted_at')
        ->select(['id', 'slug', 'updated_at'])
        ->latest('updated_at')
        ->chunk(500, fn ($products) => $products->each(fn ($product) => $urls->push(route('product.show', $product->slug ?: $product->id))));

    ContentItem::query()
        ->where('visibility', 'published')
        ->where('moderation_status', 'approved')
        ->select(['slug', 'updated_at'])
        ->latest('updated_at')
        ->chunk(500, fn ($items) => $items->each(fn ($item) => $urls->push(route('content.show', $item))));

    Bundle::query()
        ->where('status', 'published')
        ->select(['slug', 'updated_at'])
        ->latest('updated_at')
        ->chunk(500, fn ($bundles) => $bundles->each(fn ($bundle) => $urls->push(route('bundle.show', $bundle))));

    SubscriptionPlan::query()
        ->where('status', 'active')
        ->select(['slug', 'updated_at'])
        ->latest('updated_at')
        ->chunk(500, fn ($plans) => $plans->each(fn ($plan) => $urls->push(route('subscription-plan.show', $plan))));

    Post::query()
        ->whereNotNull('public_id')
        ->select(['public_id', 'updated_at'])
        ->latest('updated_at')
        ->chunk(500, fn ($posts) => $posts->each(fn ($post) => $urls->push(route('post.show', $post->public_id))));

    $xml = view('sitemap', [
        'urls' => $urls->unique()->values(),
    ])->render();

    return response($xml, 200)->header('Content-Type', 'application/xml');
})->name('sitemap');

// ─── ADMIN PANEL ────────────────────────────────────────────────────────────
Route::middleware(['auth', 'admin'])->group(function () {
    Route::prefix('/admin/api')->group(function () {
        Route::get('/disputes', [AdminController::class, 'indexDisputes']);
        Route::post('/disputes/{dispute}/resolve', [AdminController::class, 'resolveDispute']);
        Route::get('/custom-delivery-events/{event}/download', [AdminController::class, 'downloadCustomDeliveryEvent']);
        Route::post('/disputes/{dispute}/trust-safety', [AdminController::class, 'handleTrustSafetyDispute']);
        Route::get('/trust-safety-reviews', [AdminController::class, 'indexTrustSafetyReviews']);
        Route::post('/trust-safety-reviews/{review}', [AdminController::class, 'resolveTrustSafetyReview']);
        Route::get('/service-risk', [AdminController::class, 'serviceRiskDashboard']);
        Route::get('/notifications', [AdminController::class, 'notificationLogs']);

        Route::get('/withdrawals', [AdminSettingsController::class, 'withdrawals']);
        Route::post('/withdrawals/{withdrawal}/approve', [AdminController::class, 'approveWithdrawal']);
        Route::get('/platform-wallet', [AdminSettingsController::class, 'platformWallet']);
        Route::get('/fee-policies', [AdminFeePolicyController::class, 'index']);
        Route::post('/fee-policies', [AdminFeePolicyController::class, 'store']);
        Route::put('/fee-policies/{feePolicy}', [AdminFeePolicyController::class, 'update']);
        Route::delete('/fee-policies/{feePolicy}', [AdminFeePolicyController::class, 'destroy']);

        Route::get('/settings', [AdminSettingsController::class, 'index']);
        Route::put('/settings', [AdminSettingsController::class, 'update']);

        Route::get('/users', [AdminSettingsController::class, 'users']);
        Route::post('/users/{user}/toggle-role', [AdminSettingsController::class, 'toggleRole']);
        Route::post('/users/{user}/toggle-ban', [AdminSettingsController::class, 'toggleBan']);

        Route::get('/merchants', [AdminController::class, 'indexMerchants']);
        Route::get('/merchants/{merchant:id}', [AdminController::class, 'showMerchant']);
        Route::put('/merchants/{merchant:id}/settings', [AdminController::class, 'updateMerchantSettings']);
        Route::get('/kyc/view', [AdminController::class, 'viewKycFile']);
        Route::get('/merchants/{merchant:id}/products', [AdminController::class, 'merchantProducts']);
        Route::get('/services', [AdminController::class, 'services']);
        Route::get('/merchants/{merchant:id}/posts', [AdminController::class, 'merchantPosts']);
        Route::get('/merchants/{merchant:id}/orders', [AdminController::class, 'merchantOrders']);
        Route::get('/merchants/{merchant:id}/catalog/{type}', [AdminController::class, 'merchantCatalogByType']);
        Route::put('/merchants/{merchant:id}', [AdminController::class, 'updateMerchant']);
        Route::post('/merchants/{merchant:id}/approve-kyc', [AdminController::class, 'approveKyc']);
        Route::post('/merchants/{merchant:id}/reject-kyc', [AdminController::class, 'rejectKyc']);
        Route::post('/merchants/{merchant:id}/service-credentials/{credential}/approve', [AdminController::class, 'approveServiceCredential']);
        Route::post('/merchants/{merchant:id}/service-credentials/{credential}/reject', [AdminController::class, 'rejectServiceCredential']);
        Route::post('/merchants/{merchant:id}/service-risk/suspend', [AdminController::class, 'suspendMerchantForServiceRisk']);
        Route::post('/merchants/{merchant:id}/toggle-suspension', [AdminController::class, 'toggleSuspension']);
        Route::get('/feed', [AdminController::class, 'adminFeed']);
        Route::get('/posts/{postRef}', [AdminController::class, 'adminPostDetail']);
        Route::delete('/posts/{postRef}', [AdminController::class, 'adminDeletePost']);
        Route::post('/posts/{postRef}/restore', [AdminController::class, 'adminRestorePost']);
        Route::get('/search', [AdminController::class, 'globalSearch']);
        Route::get('/analytics', [AdminController::class, 'platformAnalytics']);
        Route::get('/analytics/events', [AdminController::class, 'platformAnalyticsEvents']);
        Route::get('/analytics/journey', [AdminController::class, 'platformAnalyticsJourney']);
        Route::get('/analytics/cohorts', [AdminController::class, 'platformAnalyticsCohorts']);
        Route::get('/analytics/export/{report}.csv', [AdminController::class, 'platformAnalyticsExport']);
        Route::get('/tracked-links', [AdminTrackedLinkController::class, 'index']);
        Route::patch('/tracked-links/{trackedLink:id}', [AdminTrackedLinkController::class, 'update']);

        Route::get('/content-reports', [ContentReportModerationController::class, 'adminIndex']);
        Route::patch('/content-reports/{contentReport:id}/resolve', [ContentReportModerationController::class, 'adminResolve']);

        Route::get('/catalog/categories', [AdminCatalogController::class, 'indexCategories']);
        Route::post('/catalog/categories', [AdminCatalogController::class, 'storeCategory']);
        Route::put('/catalog/categories/{category}', [AdminCatalogController::class, 'updateCategory']);
        Route::delete('/catalog/categories/{category}', [AdminCatalogController::class, 'destroyCategory']);
        Route::post('/catalog/categories/{category}/attributes', [AdminCatalogController::class, 'storeAttribute']);
        Route::put('/catalog/attributes/{attribute}', [AdminCatalogController::class, 'updateAttribute']);
        Route::delete('/catalog/attributes/{attribute}', [AdminCatalogController::class, 'destroyAttribute']);
        Route::get('/catalog/unit-types', [AdminCatalogController::class, 'indexUnitTypes']);
        Route::post('/catalog/unit-types', [AdminCatalogController::class, 'storeUnitType']);
        Route::put('/catalog/unit-types/{unitType}', [AdminCatalogController::class, 'updateUnitType']);
        Route::delete('/catalog/unit-types/{unitType}', [AdminCatalogController::class, 'destroyUnitType']);
        Route::get('/catalog/brands', [AdminCatalogController::class, 'indexBrands']);
        Route::post('/catalog/brands', [AdminCatalogController::class, 'storeBrand']);
        Route::put('/catalog/brands/{brand}', [AdminCatalogController::class, 'updateBrand']);
        Route::delete('/catalog/brands/{brand}', [AdminCatalogController::class, 'destroyBrand']);
        Route::post('/catalog/brands/{brand}/models', [AdminCatalogController::class, 'storeBrandModel']);
        Route::put('/catalog/brand-models/{brandModel}', [AdminCatalogController::class, 'updateBrandModel']);
        Route::delete('/catalog/brand-models/{brandModel}', [AdminCatalogController::class, 'destroyBrandModel']);
        Route::get('/service-categories', [ServiceCategoryController::class, 'index']);
        Route::post('/service-categories', [ServiceCategoryController::class, 'store']);
        Route::put('/service-categories/{serviceCategory}', [ServiceCategoryController::class, 'update']);
        Route::delete('/service-categories/{serviceCategory}', [ServiceCategoryController::class, 'destroy']);
    });

    Route::get('/admin', function () {
        return Inertia::render('Admin/Dashboard');
    });

    Route::get('/admin/disputes', function () {
        return Inertia::render('Admin/Disputes');
    });
    Route::get('/admin/trust-safety-reviews', function () {
        return Inertia::render('Admin/TrustSafetyReviews');
    });
    Route::get('/admin/service-risk', function () {
        return Inertia::render('Admin/ServiceRisk');
    });
    Route::get('/admin/notifications', function () {
        return Inertia::render('Admin/Notifications');
    });

    Route::get('/admin/users', function () {
        return Inertia::render('Admin/Users');
    });

    Route::get('/admin/verifications', function () {
        return Inertia::render('Admin/Verifications');
    });

    Route::get('/admin/merchants', function () {
        return Inertia::render('Admin/Merchants');
    });
    Route::get('/admin/merchants/{merchant}', function (string $merchant) {
        return Inertia::render('Admin/MerchantDetails', ['merchantId' => (int) $merchant]);
    });
    Route::get('/admin/merchants/{merchant}/settings', function (string $merchant) {
        return Inertia::render('Admin/MerchantSettings', ['merchantId' => (int) $merchant]);
    });
    Route::get('/admin/merchants/{merchant}/catalog/{type}', function (string $merchant, string $type) {
        return Inertia::render('Admin/MerchantCatalogType', ['merchantId' => (int) $merchant, 'type' => $type]);
    });
    Route::get('/admin/feed', function () {
        return Inertia::render('Admin/FeedMonitor');
    });
    Route::get('/admin/analytics', function () {
        return Inertia::render('Admin/Analytics');
    });
    Route::get('/admin/posts/{postRef}', [AdminController::class, 'adminShowPostDetailPage']);

    Route::get('/admin/content-reports', function () {
        return Inertia::render('Admin/ContentReports');
    });
    Route::get('/admin/tracked-links', function () {
        return Inertia::render('Admin/TrackedLinks');
    });

    Route::get('/admin/categories', function () {
        return Inertia::render('Admin/Categories');
    });

    Route::get('/admin/brands', function () {
        return Inertia::render('Admin/Brands');
    });

    Route::get('/admin/sellable-units', function () {
        return Inertia::render('Admin/SellableUnits');
    });

    Route::get('/admin/service-categories', function () {
        return Inertia::render('Admin/ServiceCategories');
    });

    Route::get('/admin/services', function () {
        return Inertia::render('Admin/Services');
    });

    Route::get('/admin/withdrawals', function () {
        return Inertia::render('Admin/Withdrawals');
    });

    Route::get('/admin/payout-settings', function () {
        return Inertia::render('Admin/PayoutSettings');
    });

    Route::get('/admin/ai-settings', function () {
        return Inertia::render('Admin/AiSettings');
    });

    Route::get('/admin/platform-wallet', function () {
        return Inertia::render('Admin/PlatformWallet');
    });

    Route::get('/admin/fee-policies', function () {
        return Inertia::render('Admin/FeePolicies', [
            'currencies' => Currency::query()
                ->where('is_active', true)
                ->orderByDesc('is_base_currency')
                ->orderBy('code')
                ->get(['id', 'code', 'name', 'symbol', 'is_base_currency']),
        ]);
    });

    Route::get('/admin/subscriptions', function () {
        return Inertia::render('Admin/Subscriptions');
    });

    Route::get('/admin/countries', [\App\Http\Controllers\Admin\CountryController::class, 'index'])->name('admin.countries');
    Route::get('/admin/countries/{country}/settings', [\App\Http\Controllers\Admin\CountryController::class, 'settings'])->name('admin.countries.settings');
    Route::patch('/admin/countries/{country}', [\App\Http\Controllers\Admin\CountryController::class, 'update'])->name('admin.countries.update');
    Route::post('/admin/countries/{country}/toggle', [\App\Http\Controllers\Admin\CountryController::class, 'toggleStatus'])->name('admin.countries.toggle');

    Route::get('/admin/settings', function () {
        return Inertia::render('Admin/Settings');
    });
});
