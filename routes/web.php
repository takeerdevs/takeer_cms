<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MerchantAuthController;
use App\Http\Controllers\Api\MerchantBundleController;
use App\Http\Controllers\Api\MerchantContentController;
use App\Http\Controllers\Api\EntitlementController;
use App\Http\Controllers\Api\ContentReportModerationController;
use App\Http\Controllers\Api\DispatchController;
use App\Http\Controllers\Api\MerchantOrderController;
use App\Http\Controllers\Api\MerchantSubscriptionPlanController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminCatalogController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\MerchantProfileController;
use App\Http\Resources\PostResource;
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
        'promotableBundles',
        'promotableSubscriptions',
    ])->latest()->take(20)->get();

    return Inertia::render('Feed', [
        'initialPosts' => PostResource::collection($posts)->resolve(),
    ]);
});

Route::get('/p/{postPublicId}', [PostController::class, 'showByPublicId'])->name('post.show');

Route::get('/product/{product}', function (Product $product) {
    $product->load(['merchant.user', 'merchant.storefrontSetting', 'attributes', 'images', 'variants']);
    // Ensure available_stock is included in the JSON representation
    $product->append('available_stock');
    $kycEnforcementMode = (string) AdminSetting::get('kyc_enforcement_mode', 'off');
    $product->setAttribute('verification_required_for_listing', $kycEnforcementMode === 'listings_and_withdrawals');

    return Inertia::render('ProductDetail', [
        'product' => $product
    ]);
})->name('product.show');

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

    $bundle->load(['merchant', 'items']);
    $productIds = $bundle->items->where('item_type', 'product')->pluck('item_id')->filter()->unique()->values();
    $variantIds = $bundle->items->where('item_type', 'product')->pluck('selected_variant_id')->filter()->unique()->values();
    $contentIds = $bundle->items->where('item_type', 'content_item')->pluck('item_id')->filter()->unique()->values();
    $productLookup = Product::query()
        ->whereIn('id', $productIds)
        ->with(['images:id,product_id,image_url,order'])
        ->get(['id', 'title', 'price', 'discounted_price', 'type', 'has_variants'])
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
                'lesson_duration_minutes' => $item->lesson_duration_minutes,
                'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
                'is_preview' => (bool) ($item->is_preview ?? false),
                'sort_order' => (int) ($item->sort_order ?? 0),
                'title' => $product?->title ?: "Product #{$item->item_id}",
                'price' => $variant ? (float) ($variant->price ?? 0) : ($product ? (float) ($product->discounted_price ?? $product->price ?? 0) : 0),
                'image_url' => $variant?->swatch_image_url ?: $product?->image_url,
                'product_type' => $product?->type,
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
                'lesson_duration_minutes' => $item->lesson_duration_minutes,
                'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
                'is_preview' => (bool) ($item->is_preview ?? false),
                'sort_order' => (int) ($item->sort_order ?? 0),
                'title' => $content?->title ?: "Content #{$item->item_id}",
                'price' => $content ? (float) ($content->price ?? 0) : 0,
                'image_url' => null,
                'product_type' => null,
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
            'lesson_duration_minutes' => $item->lesson_duration_minutes,
            'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
            'is_preview' => (bool) ($item->is_preview ?? false),
            'sort_order' => (int) ($item->sort_order ?? 0),
            'title' => "{$item->item_type} #{$item->item_id}",
            'price' => 0,
            'image_url' => null,
            'product_type' => null,
        ];
    })->values()->all();

    return Inertia::render('BundleDetail', [
        'bundle' => $bundlePayload,
    ]);
})->name('bundle.show');

Route::get('/plan/{subscriptionPlan}', function (SubscriptionPlan $subscriptionPlan) {
    abort_if($subscriptionPlan->status !== 'active', 404);

    $subscriptionPlan->load(['merchant', 'items']);

    // Load latest posts linked to this subscription plan for content preview
    $linkedPosts = Post::where('promotable_type', SubscriptionPlan::class)
        ->where('promotable_id', $subscriptionPlan->id)
        ->where('is_restricted', true)
        ->latest()
        ->get(['id', 'public_id', 'title', 'excerpt', 'caption', 'created_at']);

    $totalLinkedContent = $linkedPosts->count();
    $previewPosts = $linkedPosts->take(3)->map(function ($post) {
        return [
            'id' => $post->id,
            'public_id' => $post->public_id,
            'title' => $post->title,
            'excerpt' => $post->excerpt ?: \Illuminate\Support\Str::limit($post->caption, 120),
            'created_at' => $post->created_at,
        ];
    })->values()->all();

    return Inertia::render('SubscriptionPlanDetail', [
        'subscriptionPlan' => $subscriptionPlan,
        'contentPreview' => $previewPosts,
        'totalLinkedContent' => $totalLinkedContent,
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
    ])->latest()->take(20)->get();

    return Inertia::render('Feed', [
        'initialPosts' => PostResource::collection($posts)->resolve(),
    ]);
});

// ─── AUTH (Stateful) ───────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/otp/send', [AuthController::class, 'sendOtp'])->middleware('throttle:5,10');
    Route::post('/otp/verify', [AuthController::class, 'verifyOtp']);
    Route::post('/merchant/check', [MerchantAuthController::class, 'check']);
    Route::post('/merchant/register', [MerchantAuthController::class, 'register']);
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
        'countries' => Country::select('id', 'name', 'iso_alpha2 as code', 'default_currency_id')->get(),
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

    Route::get('/profile', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        $merchantIds = $user->merchantProfiles()->pluck('id');

        // This Month Earnings (Sum of total_paid for successful orders this month)
        $thisMonthEarnings = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid']) 
            ->whereMonth('created_at', \Carbon\Carbon::now()->month)
            ->whereYear('created_at', \Carbon\Carbon::now()->year)
            ->sum('total_paid');

        // Quantities by category (across all time or this month? User said "monthly stats to show total earnings" but for chart "only show the quantity of sales in each." Let's do all time, or maybe this month. We will do this month to match earnings context).
        $orders = \App\Models\Order::whereIn('merchant_id', $merchantIds)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->with('product:id,type')
            ->get(['id', 'purchasable_type', 'product_id', 'quantity']);

        $breakdown = ['digital' => 0, 'physical' => 0, 'services' => 0];

        foreach ($orders as $order) {
            $qty = $order->quantity ?? 1;
            if ($order->purchasable_type === 'product' && $order->product) {
                if ($order->product->type === 'physical') {
                    $breakdown['physical'] += $qty;
                } elseif ($order->product->type === 'service') {
                    $breakdown['services'] += $qty;
                } else {
                    $breakdown['digital'] += $qty;
                }
            } else {
                $breakdown['digital'] += $qty;
            }
        }

        return Inertia::render('Profile', [
            'thisMonthEarnings' => (float) $thisMonthEarnings,
            'salesBreakdown' => $breakdown,
            'countries' => \App\Models\Country::select('id', 'name', 'iso_alpha2 as code', 'default_currency_id')->get(),
            'currencies' => \App\Models\Currency::select('id', 'code', 'symbol', 'name')->get(),
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

        // Create the new merchant profile
        $merchant = \App\Models\Merchant::create([
            'user_id' => $user->id,
            'username' => $username,
            'display_name' => $validated['display_name'],
            'is_verified' => false,
            'is_default' => !$user->merchantProfiles()->exists(), // true if first shop
            'country_id' => $validated['country_id'],
            'currency_id' => $validated['currency_id'],
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

        $isEscrowOrder = ($orderModel->product?->type === 'physical');
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
            return Inertia::render('Merchant/Dashboard', [
                'merchantUsername' => $merchant->username,
                'merchantName' => $merchant->display_name,
            ]);
        });

        Route::get('/settings', [MerchantProfileController::class, 'edit'])->name('merchant.settings.edit');
        Route::post('/settings', [MerchantProfileController::class, 'update'])->name('merchant.settings.update');

        Route::get('/upload', function (Merchant $merchant) {
            return Inertia::render('Merchant/Upload', [
                'merchantUsername' => $merchant->username,
            ]);
        });

        Route::get('/products', function (Request $request, Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'redirectToStudio' => false,
                'typeScope' => 'physical',
            ]);
        });

        Route::get('/products/{productId}', function (Merchant $merchant, int $productId) {
            return Inertia::render('Merchant/ProductDetails', [
                'merchantUsername' => $merchant->username,
                'productId' => $productId,
            ]);
        })->whereNumber('productId');

        Route::get('/content', function (Request $request, Merchant $merchant) {
            return Inertia::render('Merchant/Content', [
                'merchantUsername' => $merchant->username,
                'initialTab' => (string) $request->query('tab', 'hub'),
                'pageMode' => 'hub',
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
            ]);
        });

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

        Route::get('/subscriptions', function (Merchant $merchant) {
            return Inertia::render('Merchant/Subscriptions', [
                'merchantUsername' => $merchant->username,
                'itemPickerDefaultLimit' => (int) AdminSetting::get('catalog_item_picker_default_limit', 5),
            ]);
        });

        Route::get('/services', function (Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'redirectToStudio' => false,
                'typeScope' => 'service',
            ]);
        });

        Route::get('/downloads', function (Merchant $merchant) {
            return Inertia::render('Merchant/Products', [
                'merchantUsername' => $merchant->username,
                'redirectToStudio' => false,
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
        Route::post('/wallet/withdraw', [\App\Http\Controllers\Api\MerchantWalletController::class, 'requestWithdrawal'])->name('merchant.wallet.withdraw');

        // ── Merchant-scoped API endpoints (still session-scoped internally) ──
        Route::get('/orders/api', [MerchantOrderController::class, 'index']);
        Route::get('/orders/api/summary', [MerchantOrderController::class, 'summary']);
        Route::get('/orders/api/commerce-summary', [MerchantOrderController::class, 'commerceSummary']);
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
    });

    // Legacy redirect: /merchant/dashboard → resolve user's default merchant
    Route::get('/merchant/dashboard', function (Request $request) {
        $merchant = $request->user()->merchantProfiles()->where('is_default', true)->first()
            ?? $request->user()->merchantProfiles()->first();
        if (!$merchant) return redirect('/merchant/register');
        return redirect("/merchant/{$merchant->username}/dashboard");
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

        // Commerce Studio Management (session-auth web endpoints)
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
        Route::get('/merchant/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'show']);
        Route::put('/merchant/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'update']);
        Route::delete('/merchant/subscription-plans/{subscriptionPlan:id}/api', [MerchantSubscriptionPlanController::class, 'destroy']);
    });

    Route::get('/merchant/content', function (Request $request) {
        $merchant = $request->user()->merchantProfiles()->where('is_default', true)->first()
            ?? $request->user()->merchantProfiles()->first();
        if (!$merchant) return redirect('/merchant/register');
        return redirect("/merchant/{$merchant->username}/content");
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

        Route::get('/withdrawals', [AdminSettingsController::class, 'withdrawals']);
        Route::post('/withdrawals/{withdrawal}/approve', [AdminController::class, 'approveWithdrawal']);

        Route::get('/settings', [AdminSettingsController::class, 'index']);
        Route::put('/settings', [AdminSettingsController::class, 'update']);

        Route::get('/users', [AdminSettingsController::class, 'users']);
        Route::post('/users/{user}/toggle-role', [AdminSettingsController::class, 'toggleRole']);
        Route::post('/users/{user}/toggle-ban', [AdminSettingsController::class, 'toggleBan']);

        Route::get('/merchants', [AdminController::class, 'indexMerchants']);
        Route::get('/merchants/{merchant:id}', [AdminController::class, 'showMerchant']);
        Route::get('/merchants/{merchant:id}/products', [AdminController::class, 'merchantProducts']);
        Route::get('/merchants/{merchant:id}/posts', [AdminController::class, 'merchantPosts']);
        Route::get('/merchants/{merchant:id}/orders', [AdminController::class, 'merchantOrders']);
        Route::get('/merchants/{merchant:id}/catalog/{type}', [AdminController::class, 'merchantCatalogByType']);
        Route::put('/merchants/{merchant:id}', [AdminController::class, 'updateMerchant']);
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
    });

    Route::get('/admin', function () {
        return Inertia::render('Admin/Dashboard');
    });

    Route::get('/admin/disputes', function () {
        return Inertia::render('Admin/Disputes');
    });

    Route::get('/admin/users', function () {
        return Inertia::render('Admin/Users');
    });

    Route::get('/admin/merchants', function () {
        return Inertia::render('Admin/Merchants');
    });
    Route::get('/admin/merchants/{merchant}', function (string $merchant) {
        return Inertia::render('Admin/MerchantDetails', ['merchantId' => (int) $merchant]);
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

    Route::get('/admin/withdrawals', function () {
        return Inertia::render('Admin/Withdrawals');
    });

    Route::get('/admin/settings', function () {
        return Inertia::render('Admin/Settings');
    });
});
