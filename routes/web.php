<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MerchantAuthController;
use App\Http\Controllers\Api\MerchantBundleController;
use App\Http\Controllers\Api\MerchantCourseController;
use App\Http\Controllers\Api\MerchantContentController;
use App\Http\Controllers\Api\EntitlementController;
use App\Http\Controllers\Api\ContentReportModerationController;
use App\Http\Controllers\Api\DispatchController;
use App\Http\Controllers\Api\MerchantOrderController;
use App\Http\Controllers\Api\MerchantPlatformSubscriptionController;
use App\Http\Controllers\Api\MerchantSubscriptionPlanController;
use App\Http\Controllers\Api\ServiceRequestController;
use App\Http\Controllers\Api\ServiceCategoryController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminCatalogController;
use App\Http\Controllers\Api\AdminFeePolicyController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\MerchantProfileController;
use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\SubscriptionPlanResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\AdminSetting;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\Country;
use App\Models\Currency;
use App\Services\EntitlementService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// ─── PUBLIC PAYMENT PAGES (Commerce Pro) ───────────────────────────────────
Route::get('/pay/retail-credit/{publicId}', [\App\Http\Controllers\Api\RetailCreditPaymentController::class, 'show'])->name('retail-credit-payment.show');
Route::get('/pay/{slug}', [\App\Http\Controllers\Api\PublicPaymentPageController::class, 'show'])->name('payment-page.show');
Route::get('/course/{product:slug}', [\App\Http\Controllers\Api\PublicCourseController::class, 'show'])->name('course.player');
Route::post('/course/lesson/{lesson}/complete', [\App\Http\Controllers\Api\PublicCourseController::class, 'toggleCompletion'])->name('course.lesson.complete');

Route::get('/', function () {
    $posts = App\Models\Post::with([
        'merchant.storefrontSetting',
        'linkedContentItem',
        'media.productImage',
        'linkedProduct.attributes',
        'linkedProduct.variants',
        'linkedProduct.images',
        'product.attributes',
        'product.variants',
        'productTags.product.attributes',
        'productTags.product.variants',
        'productTags.product.images',
        'reactions',
        'promotableProducts',
        'promotableBundles',
        'promotableSubscriptions',
    ])->latest()->take(20)->get();

    return Inertia::render('Feed', [
        'initialPosts' => PostResource::collection($posts)->resolve(),
    ]);
});

Route::get('/p/{postPublicId}', [PostController::class, 'showByPublicId'])->name('post.show');

Route::get('/product/{product}', function (Product $product) {
    $product->load([
        'merchant.user',
        'merchant.storefrontSetting',
        'attributes.brand',
        'attributes.model',
        'images',
        'variants',
        'categoryAttributeValues.categoryAttribute'
    ]);

    // Ensure available_stock is included
    $product->append('available_stock');
    $kycEnforcementMode = (string) AdminSetting::get('kyc_enforcement_mode', 'off');
    $product->setAttribute('verification_required_for_listing', $kycEnforcementMode === 'listings_and_withdrawals');

    // Track traffic
    $product->recordImpression(request());

    return Inertia::render('ProductDetail', [
        'product' => ProductResource::make($product)->resolve()
    ]);
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
        'status' => $serviceRequest->status,
        'payment_status' => $serviceRequest->payment_status,
        'delivery_status' => $serviceRequest->delivery_status,
        'expires_at' => $serviceRequest->payment_link_expires_at?->toISOString(),
    ]);

    return Inertia::render('ProductDetail', [
        'product' => ProductResource::make($product)->resolve(),
    ]);
})->name('service-request.pay');

Route::get('/search', function (Request $request) {
    return Inertia::render('Search', [
        'initialQuery' => trim((string) $request->query('q', '')),
        'initialPage' => max((int) $request->query('page', 1), 1),
    ]);
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
            if ($contentItem->format === 'plain_text' && trim((string) $contentItem->title) === $internalShortTitle) {
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

    return Inertia::render('ContentItemDetail', [
        'contentItem' => [
            'id' => $contentItem->id,
            'title' => ($contentItem->format === 'plain_text' && trim((string) $contentItem->title) === $internalShortTitle)
                ? null
                : $contentItem->title,
            'slug' => $contentItem->slug,
            'excerpt' => trim((string) preg_replace('/\s*Tap unlock to continue\.\s*$/i', '', (string) $contentItem->excerpt)),
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
    ]);
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

    return Inertia::render('BundleDetail', [
        'bundle' => $bundlePayload,
    ]);
})->name('bundle.show');

Route::get('/plan/{subscriptionPlan}', function (SubscriptionPlan $subscriptionPlan) {
    abort_if($subscriptionPlan->status !== 'active', 404);

    $subscriptionPlan->load(['merchant', 'items']);

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
            'excerpt' => $post->excerpt ?: \Illuminate\Support\Str::limit($post->caption, 120),
            'created_at' => $post->created_at,
        ]);

    $allPreviewContent = $planContent
        ->concat($linkedPosts)
        ->sortByDesc('created_at')
        ->values();

    return Inertia::render('SubscriptionPlanDetail', [
        'subscriptionPlan' => SubscriptionPlanResource::make($subscriptionPlan)->resolve(request()),
        'contentPreview' => $allPreviewContent->take(3)->values()->all(),
        'totalLinkedContent' => $allPreviewContent->count(),
    ]);
})->name('subscription-plan.show');

// Onboarding landing (for users who aren't logged in yet)
Route::get('/welcome', function () {
    return Inertia::render('Welcome');
})->name('login');

Route::get('/terms', function () {
    return Inertia::render('Terms');
})->name('terms');

Route::get('/privacy', function () {
    return Inertia::render('Privacy');
})->name('privacy');

Route::get('/{merchantSlug}/terminal', function (string $merchantSlug) {
    $merchant = \App\Models\Merchant::where('username', $merchantSlug)->firstOrFail();
    return Inertia::render('Auth/StaffPinLogin', [
        'merchant' => $merchant
    ]);
})->name('retail.terminal');

Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::get('/feed', function () {
    $posts = App\Models\Post::with([
        'merchant.storefrontSetting',
        'linkedContentItem',
        'media.productImage',
        'linkedProduct.attributes',
        'linkedProduct.images',
        'product.attributes',
        'productTags.product.attributes',
        'productTags.product.images',
        'reactions',
        'promotableProducts',
        'promotableBundles',
        'promotableSubscriptions',
    ])->latest()->take(20)->get();

    return Inertia::render('Feed', [
        'initialPosts' => PostResource::collection($posts)->resolve(),
    ]);
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
Route::middleware('auth')->group(function () {
    Route::get('/auth/google/redirect', function () {
        return \Laravel\Socialite\Facades\Socialite::driver('google')->redirect();
    });

    Route::get('/auth/google/callback', function (\Illuminate\Http\Request $request) {
        try {
            $googleUser = \Laravel\Socialite\Facades\Socialite::driver('google')->user();
            $user = $request->user();
            
            if ($user && $googleUser->getEmail()) {
                $user->email = $googleUser->getEmail();
                $user->email_verified_at = now();
                $user->save();
                return redirect('/profile/settings')->with('success', 'Akaunti yako ya Google imeunganishwa kikamilifu!');
            }
            return redirect('/profile/settings')->with('error', 'Imeshindwa kupata barua pepe (email).');
        } catch (\Exception $e) {
            return redirect('/profile/settings')->with('error', 'Kuna tatizo wakati wa kuunganisha na Google.');
        }
    });
});

// ─── MERCHANT ───────────────────────────────────────────────────────────────
Route::get('/merchant/register', function () {
    return Inertia::render('Auth/MerchantRegister', [
        'countries' => Country::select('id', 'name', 'iso_alpha2 as code', 'default_currency_id', 'timezone', 'settings')->get(),
        'currencies' => Currency::select('id', 'code', 'symbol', 'name')->get(),
    ]);
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
    Route::get('/orders/data/entitlements', [EntitlementController::class, 'myLibrary']);
    Route::get('/orders/data/subscriptions', [SubscriptionController::class, 'mySubscriptions']);
    Route::get('/orders/{order}/download', [\App\Http\Controllers\Api\DownloadController::class, 'download']);
    Route::get('/orders/{order}/download/local', [\App\Http\Controllers\Api\DownloadController::class, 'downloadLocal'])->name('web.download.local');
    Route::get('/learn/bundles/{bundle}', [\App\Http\Controllers\Api\BundleCourseController::class, 'show'])->name('bundle.learn');
    Route::post('/learn/bundle-lessons/{lesson}/complete', [\App\Http\Controllers\Api\BundleCourseController::class, 'toggleCompletion'])->name('bundle.lesson.complete');
    Route::post('/learn/bundle-live-sessions/{session}/check-in', [\App\Http\Controllers\Api\BundleCourseController::class, 'checkIn'])->name('bundle.live-session.check-in');

    Route::post('/merchant/switch/{username}', [\App\Http\Controllers\Api\MerchantSwitchController::class, 'switch'])->name('merchant.switch');
    Route::post('/merchant/add-business', [\App\Http\Controllers\Api\MerchantAuthController::class, 'addBusinessProfile'])->name('merchant.add-business');

    Route::get('/profile', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        
        // Determine active merchant
        $activeMerchantId = Session::get('active_merchant_id');
        $merchantProfiles = $user->merchantProfiles()->with(['kyc', 'locations'])->get();
        
        $activeMerchant = $activeMerchantId 
            ? $merchantProfiles->find($activeMerchantId) 
            : ($merchantProfiles->where('is_default', true)->first() ?? $merchantProfiles->first());

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
            'digital' => 0,
            'services' => 0,
            'posts' => 0,
            'bundles' => 0,
            'subscriptions' => 0,
        ];

        if ($activeMerchant) {
            $productTypeCounts = $activeMerchant->products()
                ->selectRaw('type, COUNT(*) as total')
                ->groupBy('type')
                ->pluck('total', 'type');

            $commerceHubSummary = [
                'physical' => (int) ($productTypeCounts['physical'] ?? 0),
                'digital' => (int) ($productTypeCounts['digital'] ?? 0),
                'services' => (int) ($productTypeCounts['service'] ?? 0),
                'posts' => (int) $activeMerchant->posts()->count(),
                'bundles' => (int) $activeMerchant->bundles()->count(),
                'subscriptions' => (int) $activeMerchant->subscriptionPlans()->count(),
            ];
        }

        return Inertia::render('Profile', [
            'activeMerchant' => $activeMerchant,
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
                ->with('product:id,title,type')
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
                    ];
                }) : [],
            'salesBreakdown' => $breakdown,
            'commerceHubSummary' => $commerceHubSummary,
            'countries' => \App\Models\Country::select('id', 'name', 'iso_alpha2 as code', 'default_currency_id')->get(),
            'currencies' => \App\Models\Currency::select('id', 'code', 'symbol', 'name')->get(),
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
        $orderModel = \App\Models\Order::with(['product', 'delivery', 'merchant.locations', 'messages' => fn($q) => $q->orderBy('created_at')])->where('public_id', $order)->firstOrFail();
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

        Route::get('/settings', [MerchantProfileController::class, 'edit'])->name('merchant.settings.edit');
        Route::post('/settings', [MerchantProfileController::class, 'update'])->name('merchant.settings.update');

        Route::get('/upload', function (Merchant $merchant) {
            abort_unless($merchant->canSellProducts(), 403, 'Complete KYC before uploading products.');

            return Inertia::render('Merchant/Upload', [
                'merchantUsername' => $merchant->username,
            ]);
        });

        Route::get('/products', function (Request $request, Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'physical',
            ]);
        });

        Route::get('/products/{productId}', function (Merchant $merchant, int $productId) {
            return Inertia::render('Merchant/ProductDetails', [
                'merchantUsername' => $merchant->username,
                'productId' => $productId,
            ]);
        })->whereNumber('productId');

        Route::get('/posts', function (Merchant $merchant) {
            return Inertia::render('Merchant/Posts', [
                'merchantUsername' => $merchant->username,
            ]);
        });

        Route::get('/bundles', function (Merchant $merchant) {
            return Inertia::render('Merchant/Bundles', [
                'merchantUsername' => $merchant->username,
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
            ]);
        });
        Route::get('/bundles/{bundle:id}/course', function (Merchant $merchant, Bundle $bundle) {
            abort_unless((int) $bundle->merchant_id === (int) $merchant->id && $bundle->is_course, 404);

            return Inertia::render('Merchant/CourseManager', [
                'merchantUsername' => $merchant->username,
                'bundleId' => $bundle->id,
            ]);
        });

        Route::get('/subscriptions', function (Merchant $merchant) {
            return Inertia::render('Merchant/Subscriptions', [
                'merchantUsername' => $merchant->username,
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
            ]);
        });

        Route::get('/services', function (Merchant $merchant) {
            $merchant->loadMissing('country');

            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'service',
                'merchantTimezone' => $merchant->defaultTimezone(),
            ]);
        });

        Route::get('/downloads', function (Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'typeScope' => 'digital',
            ]);
        });

        Route::get('/orders', function (Merchant $merchant) {
            return Inertia::render('Merchant/Orders', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
            ]);
        });

        Route::get('/wallet', [\App\Http\Controllers\Api\MerchantWalletController::class, 'show'])->name('merchant.wallet');
        Route::get('/wallet/ledger', [\App\Http\Controllers\Api\MerchantWalletController::class, 'showLedger'])->name('merchant.wallet.ledger');
        Route::post('/wallet/withdraw', [\App\Http\Controllers\Api\MerchantWalletController::class, 'requestWithdrawal'])->name('merchant.wallet.withdraw');
        Route::get('/platform-subscriptions/retail-operations', function (Merchant $merchant) {
            abort_unless($merchant->isRetailEligible(), 403, 'Retail Operations is only available for verified business accounts with completed business KYC.');

            return Inertia::render('Merchant/PlatformSubscription', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'featureKey' => 'retail_ops',
            ]);
        })->name('merchant.platform-subscriptions.retail-operations');
        Route::get('/platform-subscriptions/storage', function (Merchant $merchant) {
            return Inertia::render('Merchant/PlatformSubscription', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'featureKey' => 'storage',
            ]);
        })->name('merchant.platform-subscriptions.storage');
        Route::get('/platform-subscriptions/api', [MerchantPlatformSubscriptionController::class, 'index']);
        Route::post('/platform-subscriptions/trial', [MerchantPlatformSubscriptionController::class, 'startTrial']);
        Route::post('/platform-subscriptions/simulate-payment', [MerchantPlatformSubscriptionController::class, 'simulatePayment']);

        // ── Merchant-scoped API endpoints (still session-scoped internally) ──
        Route::get('/products/api', [UploadController::class, 'index']);
        Route::get('/products/{id}/api', [UploadController::class, 'show'])->whereNumber('id');
        Route::delete('/products/{id}', [UploadController::class, 'deleteProduct'])->whereNumber('id');
        Route::post('/products/{product}/hotspots', [UploadController::class, 'syncHotspots'])->whereNumber('product');
        Route::post('/upload/media', [UploadController::class, 'uploadMedia']);
        Route::post('/upload/draft', [UploadController::class, 'draftProduct']);
        Route::post('/upload/manual', [UploadController::class, 'manualDraft']);
        Route::post('/upload/publish', [UploadController::class, 'publishProduct']);
        Route::get('/catalog/schema', [UploadController::class, 'catalogSchema']);
        Route::post('/posts', [PostController::class, 'store']);
        Route::delete('/posts/{post}', [PostController::class, 'destroy']);

        Route::get('/content-items/api', [MerchantContentController::class, 'index']);
        Route::post('/content-items/api', [MerchantContentController::class, 'store']);
        Route::get('/content-items/{contentItem:id}/api', [MerchantContentController::class, 'show']);
        Route::put('/content-items/{contentItem:id}/api', [MerchantContentController::class, 'update']);
        Route::delete('/content-items/{contentItem:id}/api', [MerchantContentController::class, 'destroy']);
        Route::get('/posts/api', [MerchantContentController::class, 'posts']);
        Route::patch('/posts/{post:id}/interaction/api', [MerchantContentController::class, 'updatePostInteraction']);
        Route::get('/content-reports/api', [ContentReportModerationController::class, 'merchantIndex']);
        Route::patch('/content-reports/{contentReport:id}/resolve/api', [ContentReportModerationController::class, 'merchantResolve']);

        Route::get('/bundles/api', fn (Request $request, Merchant $merchant, MerchantBundleController $controller) => $controller->index($request));
        Route::post('/bundles/api', fn (Request $request, Merchant $merchant, MerchantBundleController $controller, EntitlementService $entitlementService) => $controller->store($request, $entitlementService));
        Route::get('/bundles/{bundle:id}/api', fn (Request $request, Merchant $merchant, Bundle $bundle, MerchantBundleController $controller) => $controller->show($request, $bundle));
        Route::put('/bundles/{bundle:id}/api', fn (Request $request, Merchant $merchant, Bundle $bundle, MerchantBundleController $controller, EntitlementService $entitlementService) => $controller->update($request, $bundle, $entitlementService));
        Route::delete('/bundles/{bundle:id}/api', fn (Request $request, Merchant $merchant, Bundle $bundle, MerchantBundleController $controller) => $controller->destroy($request, $bundle));
        Route::get('/bundles/{bundle:id}/course/api', [MerchantCourseController::class, 'dashboard']);
        Route::post('/bundles/{bundle:id}/course/sessions/{session:id}/check-in-code', [MerchantCourseController::class, 'generateCheckInCode']);
        Route::post('/bundles/{bundle:id}/course/sessions/{session:id}/attendance', [MerchantCourseController::class, 'markAttendance']);

        Route::get('/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'index']);
        Route::post('/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'store']);
        Route::get('/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'show']);
        Route::put('/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'update']);
        Route::delete('/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'destroy']);

        Route::get('/orders/api', [MerchantOrderController::class, 'index']);
        Route::get('/orders/api/summary', [MerchantOrderController::class, 'summary']);
        Route::get('/orders/api/commerce-summary', [MerchantOrderController::class, 'commerceSummary']);
        Route::get('/service-requests/api', [ServiceRequestController::class, 'merchantIndex']);
        Route::get('/service-requests/{serviceRequest}/attachments/{field}/{index}', [ServiceRequestController::class, 'showAttachment'])->where('field', '[^/]+')->whereNumber('index');
        Route::patch('/service-requests/{serviceRequest}/status', [ServiceRequestController::class, 'updateStatus']);
        Route::post('/service-requests/{serviceRequest}/mark-delivered', [ServiceRequestController::class, 'markDelivered']);
        Route::post('/service-requests/{serviceRequest}/prepare-notification', [ServiceRequestController::class, 'prepareNotification']);
        Route::post('/service-requests/{serviceRequest}/prepare-calendar-event', [ServiceRequestController::class, 'prepareCalendarEvent']);
        Route::get('/service-scheduling/api', [ServiceRequestController::class, 'scheduling']);
        Route::put('/service-scheduling/api', [ServiceRequestController::class, 'updateScheduling']);
        Route::get('/service-sessions/api', [ServiceRequestController::class, 'sessions']);
        Route::put('/service-sessions/api', [ServiceRequestController::class, 'updateSessions']);
        Route::get('/orders/{order}/api', [MerchantOrderController::class, 'show']);
        Route::post('/dispatch/{order}/intercity', [DispatchController::class, 'intercity']);
        Route::post('/dispatch/{order}/local', [DispatchController::class, 'local']);
        Route::get('/orders/{order}', function (Merchant $merchant, \App\Models\Order $order) {
            abort_unless($order->merchant_id === $merchant->id, 404);

            return Inertia::render('Merchant/OrderDetails', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
                'orderId' => $order->id,
            ]);
        });
        Route::get('/wallet/api/history', [\App\Http\Controllers\Api\MerchantWalletController::class, 'history']);
        
        // KYC endpoints
        Route::get('/kyc/api', [\App\Http\Controllers\Api\MerchantKycController::class, 'show']);
        Route::post('/kyc/api', [\App\Http\Controllers\Api\MerchantKycController::class, 'store']);
        Route::get('/service-credentials/api', [\App\Http\Controllers\Api\MerchantServiceCredentialController::class, 'index']);
        Route::post('/service-credentials/api', [\App\Http\Controllers\Api\MerchantServiceCredentialController::class, 'store']);
        Route::delete('/service-credentials/api/{credential}', [\App\Http\Controllers\Api\MerchantServiceCredentialController::class, 'destroy']);
        
        Route::get('/verification', function (Merchant $merchant) {
            return Inertia::render('Merchant/VerificationCenter', [
                'merchantUsername' => $merchant->username,
            ]);
        });

        // ── RETAIL OPS PAGES ──
        Route::middleware('retail_ops')->prefix('retail')->group(function () {
            Route::get('/dashboard', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Dashboard', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('retail_role:MANAGER');

            Route::get('/trust-safety', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/TrustSafety', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('retail_role:MANAGER');

            Route::get('/staff', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Staff', ['merchant' => $merchant]);
            })->middleware('retail_role:MANAGER');
            Route::get('/customers', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Customers', ['merchant' => $merchant]);
            })->middleware('retail_role:MANAGER,STOREKEEPER');
            Route::get('/outstanding', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Outstanding', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('retail_role:MANAGER,CASHIER');
            Route::get('/transfers', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Transfers', ['merchant' => $merchant]);
            })->middleware('retail_role:MANAGER,STOREKEEPER');
            Route::get('/products/{product:id}/timeline', function (Merchant $merchant, \App\Models\Product $product) {
                abort_unless((int) $product->merchant_id === (int) $merchant->id, 404);
                return Inertia::render('Merchant/Retail/ProductTimeline', [
                    'merchant' => $merchant->load('currency'),
                    'productId' => $product->id,
                ]);
            })->middleware('retail_role:MANAGER,STOREKEEPER');
            Route::get('/inventory', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Inventory', ['merchant' => $merchant->load('currency')]);
            })->middleware('retail_role:MANAGER,STOREKEEPER');
            Route::get('/storekeeper', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Storekeeper', ['merchant' => $merchant]);
            })->middleware('retail_role:MANAGER,STOREKEEPER,CASHIER');

            Route::get('/settings', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/Settings', ['merchant' => $merchant]);
            })->middleware('retail_role:MANAGER');

            Route::get('/pos', function (Merchant $merchant) {
                return Inertia::render('Merchant/Retail/PosTerminal', [
                    'merchant' => $merchant->load('currency'),
                ]);
            })->middleware('retail_role:MANAGER,CASHIER');

            Route::get('/onboarding/template', [\App\Http\Controllers\Api\RetailOnboardingController::class, 'downloadTemplate']);
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
        Route::get('/merchant/products/api', [UploadController::class, 'index']);
        Route::get('/merchant/products/{id}/api', [UploadController::class, 'show']);
        Route::delete('/merchant/products/{id}', [UploadController::class, 'deleteProduct']);
        Route::post('/merchant/upload/media', [UploadController::class, 'uploadMedia']);
        Route::post('/merchant/upload/draft', [UploadController::class, 'draftProduct']);
        Route::post('/merchant/upload/manual', [UploadController::class, 'manualDraft']);
        Route::post('/merchant/upload/publish', [UploadController::class, 'publishProduct']);
        Route::get('/merchant/catalog/schema', [UploadController::class, 'catalogSchema']);
        Route::post('/merchant/products/{product}/hotspots', [UploadController::class, 'syncHotspots']);
        Route::post('/merchant/posts', [PostController::class, 'store']);
        Route::delete('/merchant/posts/{post}', [PostController::class, 'destroy']);

        // Commerce management (session-auth web endpoints)
        Route::get('/merchant/content-items/api', [MerchantContentController::class, 'index']);
        Route::post('/merchant/content-items/api', [MerchantContentController::class, 'store']);
        Route::get('/merchant/content-items/{contentItem:id}/api', [MerchantContentController::class, 'show']);
        Route::put('/merchant/content-items/{contentItem:id}/api', [MerchantContentController::class, 'update']);
        Route::delete('/merchant/content-items/{contentItem:id}/api', [MerchantContentController::class, 'destroy']);
        Route::get('/merchant/posts/api', [MerchantContentController::class, 'posts']);
        Route::patch('/merchant/posts/{post:id}/interaction/api', [MerchantContentController::class, 'updatePostInteraction']);
        Route::get('/merchant/content-reports/api', [ContentReportModerationController::class, 'merchantIndex']);
        Route::patch('/merchant/content-reports/{contentReport:id}/resolve/api', [ContentReportModerationController::class, 'merchantResolve']);

        Route::get('/merchant/bundles/api', [MerchantBundleController::class, 'index']);
        Route::post('/merchant/bundles/api', [MerchantBundleController::class, 'store']);
        Route::get('/merchant/bundles/{bundle:id}/api', [MerchantBundleController::class, 'show']);
        Route::put('/merchant/bundles/{bundle:id}/api', [MerchantBundleController::class, 'update']);
        Route::delete('/merchant/bundles/{bundle:id}/api', [MerchantBundleController::class, 'destroy']);

        Route::get('/merchant/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'index']);
        Route::post('/merchant/subscription-plans/api', [MerchantSubscriptionPlanController::class, 'store']);
        Route::get('/merchant/subscription-plans/{plan:id}/api', [MerchantSubscriptionPlanController::class, 'show']);
        Route::put('/merchant/subscription-plans/{plan:id}/api', [MerchantSubscriptionPlanController::class, 'update']);
        Route::delete('/merchant/subscription-plans/{plan:id}/api', [MerchantSubscriptionPlanController::class, 'destroy']);

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
    return Inertia::render('MiniStore', ['merchantSlug' => $slug]);
});
Route::get('/m/{slug}/feed', function (string $slug) {
    return Inertia::render('MiniStoreFeed', ['merchantSlug' => $slug]);
});
Route::get('/m/{slug}/products', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'products']);
});
Route::get('/m/{slug}/downloads', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'downloads']);
});
Route::get('/m/{slug}/services', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'services']);
});
Route::get('/m/{slug}/content', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'content']);
});
Route::get('/m/{slug}/bundles', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'bundles']);
});
Route::get('/m/{slug}/courses', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'courses']);
});
Route::get('/m/{slug}/memberships', function (string $slug) {
    return Inertia::render('MiniStoreSection', ['merchantSlug' => $slug, 'sectionType' => 'memberships']);
});

// ─── ADMIN PANEL ────────────────────────────────────────────────────────────
Route::middleware(['auth', 'admin'])->group(function () {
    Route::prefix('/admin/api')->group(function () {
        Route::get('/disputes', [AdminController::class, 'indexDisputes']);
        Route::post('/disputes/{dispute}/resolve', [AdminController::class, 'resolveDispute']);
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
        Route::get('/search', [AdminController::class, 'globalSearch']);

        Route::get('/content-reports', [ContentReportModerationController::class, 'adminIndex']);
        Route::patch('/content-reports/{contentReport:id}/resolve', [ContentReportModerationController::class, 'adminResolve']);

        Route::get('/catalog/categories', [AdminCatalogController::class, 'indexCategories']);
        Route::post('/catalog/categories', [AdminCatalogController::class, 'storeCategory']);
        Route::put('/catalog/categories/{category}', [AdminCatalogController::class, 'updateCategory']);
        Route::delete('/catalog/categories/{category}', [AdminCatalogController::class, 'destroyCategory']);
        Route::post('/catalog/categories/{category}/attributes', [AdminCatalogController::class, 'storeAttribute']);
        Route::put('/catalog/attributes/{attribute}', [AdminCatalogController::class, 'updateAttribute']);
        Route::delete('/catalog/attributes/{attribute}', [AdminCatalogController::class, 'destroyAttribute']);
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
    Route::get('/admin/posts/{postRef}', [AdminController::class, 'adminShowPostDetailPage']);

    Route::get('/admin/content-reports', function () {
        return Inertia::render('Admin/ContentReports');
    });

    Route::get('/admin/categories', function () {
        return Inertia::render('Admin/Categories');
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
