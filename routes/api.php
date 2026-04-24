<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminCatalogController;
use App\Http\Controllers\Api\AdminSettingsController;
use App\Http\Controllers\Api\AiSearchController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\CommerceCatalogController;
use App\Http\Controllers\Api\ContentReportModerationController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\DispatchController;
use App\Http\Controllers\Api\EntitlementController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\MerchantBundleController;
use App\Http\Controllers\Api\MerchantContentController;
use App\Http\Controllers\Api\MerchantOrderController;
use App\Http\Controllers\Api\MerchantSubscriptionPlanController;
use App\Http\Controllers\Api\MiniStoreController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\Payments\AzamPayCallbackController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\SecureAccessController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\WaitlistController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Takeer Social Commerce Platform
|--------------------------------------------------------------------------
*/

Route::get('/health', fn() => response()->json(['status' => 'ok']));


// ─── PAYMENT GATEWAY CALLBACKS (public — no auth, signature-verified) ─────────
// Each gateway gets its own route for clear separation and independent logging.
// AzamPay posts here after customer completes USSD PIN prompt (Tanzania).
Route::post('/payments/tz/azampay', [AzamPayCallbackController::class, 'handle'])
    ->name('payments.callback.azampay');

Route::post('/payments/tz/flutterwave', [\App\Http\Controllers\Api\Payments\FlutterwaveCallbackController::class, 'handle'])
    ->name('payments.callback.flutterwave');


// ─── WEBHOOKS (legacy M-Pesa placeholder) ────────────────────────────────────
Route::post('/webhooks/mpesa', [PaymentWebhookController::class, 'callback']);

// ─── PUBLIC DISCOVERY ───────────────────────────────────────────────────────
Route::get('/feed', [FeedController::class, 'index']);
Route::get('/posts/{post}/comments', [PostController::class, 'comments'])->withTrashed();
Route::get('/pwa/product/{product}', [ProductController::class, 'show']);
Route::get('/pwa/post/{post}', [PostController::class, 'getPostData']);
Route::get('/content-items/{contentItem}', [CommerceCatalogController::class, 'showContentItem']);
Route::get('/bundles/{bundle}', [CommerceCatalogController::class, 'showBundle']);
Route::get('/subscription-plans/{subscriptionPlan}', [CommerceCatalogController::class, 'showSubscriptionPlan']);

// ─── AI SEARCH ──────────────────────────────────────────────────────────────
Route::post('/search/text', [AiSearchController::class, 'textSearch'])->middleware('throttle:10,1');
Route::post('/search/visual', [AiSearchController::class, 'visualSearch'])->middleware('throttle:5,1');

// ─── PROTECTED ROUTES ───────────────────────────────────────────────────────
// Guest Checkout accessible without auth
Route::post('/v1/checkout/initiate', [CheckoutController::class, 'initiate']);

Route::middleware('auth:sanctum')->group(function () {

    // Auth & Profile
    Route::get('/user', fn(Request $request) => $request->user());
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/profile/one-click/setup', [ProfileController::class, 'setupOneClick']);

    // Buyer Checkout & Orders
    Route::post('/orders/{order}/complete', [CheckoutController::class, 'complete']);
    Route::post('/buyer/orders/{order}/confirm-receipt', [\App\Http\Controllers\Api\BuyerEscrowController::class, 'confirmReceipt']);
    Route::post('/buyer/orders/{order}/dispute', [\App\Http\Controllers\Api\BuyerEscrowController::class, 'fileDispute']);
    Route::get('/orders/{order}/download', [\App\Http\Controllers\Api\DownloadController::class, 'download']);
    Route::post('/orders/{order}/send-download-link', [\App\Http\Controllers\Api\DownloadController::class, 'sendDownloadLink']);
    Route::get('/orders/{order}/download/local', [\App\Http\Controllers\Api\DownloadController::class, 'downloadLocal'])->name('api.download.local');
    Route::post('/content-items/{contentItem:id}/access-link', [SecureAccessController::class, 'contentAccessLink']);
    Route::get('/content-items/{contentItem:id}/secure-body', [SecureAccessController::class, 'contentBody'])->name('api.content-items.secure-body');
    Route::get('/me/entitlements', [EntitlementController::class, 'myLibrary']);
    Route::post('/me/entitlements/check', [EntitlementController::class, 'canAccess']);
    Route::post('/content/report', [EntitlementController::class, 'reportContent']);
    Route::post('/subscriptions/plans/{subscriptionPlan}/subscribe', [SubscriptionController::class, 'subscribe']);
    Route::get('/me/subscriptions', [SubscriptionController::class, 'mySubscriptions']);
    Route::post('/me/subscriptions/{userSubscription}/cancel', [SubscriptionController::class, 'cancel']);

    // User Addresses
    Route::get('/me/addresses', [\App\Http\Controllers\Api\UserAddressController::class, 'index']);
    Route::post('/me/addresses', [\App\Http\Controllers\Api\UserAddressController::class, 'store']);
    Route::put('/me/addresses/{address}', [\App\Http\Controllers\Api\UserAddressController::class, 'update']);
    Route::delete('/me/addresses/{address}', [\App\Http\Controllers\Api\UserAddressController::class, 'destroy']);
    Route::post('/me/addresses/{address}/set-default', [\App\Http\Controllers\Api\UserAddressController::class, 'setDefault']);
    
    // Forwarders
    Route::get('/forwarders', [\App\Http\Controllers\Api\ForwarderController::class, 'index']);

    // Merchant Controls
    Route::middleware('merchant_status')->prefix('merchant')->group(function () {
        Route::put('/settings', [\App\Http\Controllers\Api\MerchantSettingsController::class, 'update']);
        Route::post('/products/{product}/sync', [ProductController::class, 'syncStock']);
        Route::post('/dispatch/{order}/intercity', [DispatchController::class, 'intercity']);
        Route::post('/dispatch/{order}/local', [DispatchController::class, 'local']);
        Route::get('/content-items', [MerchantContentController::class, 'index']);
        Route::post('/content-items', [MerchantContentController::class, 'store']);
        Route::get('/content-items/{contentItem:id}', [MerchantContentController::class, 'show']);
        Route::put('/content-items/{contentItem:id}', [MerchantContentController::class, 'update']);
        Route::delete('/content-items/{contentItem:id}', [MerchantContentController::class, 'destroy']);
        Route::get('/posts', [MerchantContentController::class, 'posts']);
        Route::patch('/posts/{post:id}/interaction', [MerchantContentController::class, 'updatePostInteraction']);

        Route::get('/bundles', [MerchantBundleController::class, 'index']);
        Route::post('/bundles', [MerchantBundleController::class, 'store']);
        Route::get('/bundles/{bundle:id}', [MerchantBundleController::class, 'show']);
        Route::put('/bundles/{bundle:id}', [MerchantBundleController::class, 'update']);
        Route::delete('/bundles/{bundle:id}', [MerchantBundleController::class, 'destroy']);

        // Merchant Order PIN Verification
        Route::post('/{merchant:username}/orders/{order:id}/verify-pickup', [MerchantOrderController::class, 'verifyPickup']);
        Route::post('/{merchant:username}/orders/{order:id}/verify-delivery', [MerchantOrderController::class, 'verifyDelivery']);
        Route::post('/{merchant:username}/orders/{order:id}/extend-lock', [MerchantOrderController::class, 'extendExpiration']);
        Route::post('/{merchant:username}/orders/{order:id}/release-inventory', [MerchantOrderController::class, 'releaseInventory']);
        Route::post('/{merchant:username}/dispatch/{order:id}/{mode}', [MerchantOrderController::class, 'dispatchOrder']);

        Route::get('/subscription-plans', [MerchantSubscriptionPlanController::class, 'index']);
        Route::post('/subscription-plans', [MerchantSubscriptionPlanController::class, 'store']);
        Route::get('/subscription-plans/{subscriptionPlan:id}', [MerchantSubscriptionPlanController::class, 'show']);
        Route::put('/subscription-plans/{subscriptionPlan:id}', [MerchantSubscriptionPlanController::class, 'update']);
        Route::delete('/subscription-plans/{subscriptionPlan:id}', [MerchantSubscriptionPlanController::class, 'destroy']);
        
        Route::get('/shipping-profiles', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'index']);
        Route::post('/shipping-profiles', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'store']);
        Route::put('/shipping-profiles/{shippingProfile:id}', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'update']);
        Route::delete('/shipping-profiles/{shippingProfile:id}', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'destroy']);
        Route::post('/shipping-profiles/{shippingProfile:id}/set-default', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'setDefault']);

        Route::get('/shipping-profiles/{shippingProfile:id}/zones', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'index']);
        Route::post('/shipping-profiles/{shippingProfile:id}/zones', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'store']);
        Route::put('/shipping-zones/{shippingZone:id}', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'update']);
        Route::delete('/shipping-zones/{shippingZone:id}', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'destroy']);

        Route::get('/content-reports', [ContentReportModerationController::class, 'merchantIndex']);
        Route::patch('/content-reports/{contentReport:id}/resolve', [ContentReportModerationController::class, 'merchantResolve']);
    });

    // Merchant Locations (outside merchant_status to avoid binding issues)
    Route::prefix('merchant')->group(function () {
        Route::get('/locations', [\App\Http\Controllers\Api\MerchantLocationController::class, 'index']);
        Route::post('/locations', [\App\Http\Controllers\Api\MerchantLocationController::class, 'store']);
        Route::put('/locations/{merchantLocation:id}', [\App\Http\Controllers\Api\MerchantLocationController::class, 'update']);
        Route::delete('/locations/{merchantLocation:id}', [\App\Http\Controllers\Api\MerchantLocationController::class, 'destroy']);
    });

    // Phase 11 Safe-Chat
    Route::get('/chat/order/{order}/messages', [ChatController::class, 'index']);
    Route::post('/chat/order/{order}/messages', [ChatController::class, 'store']);
    Route::get('/chat/order/{order}/search-products', [ChatController::class, 'merchantProducts']);
    Route::post('/media/upload', [UploadController::class, 'uploadMedia']);

    // Shipping Inquiries
    Route::post('/v1/checkout/inquire', [CheckoutController::class, 'inquire']);
    Route::post('/v1/checkout/pay-inquiry/{order}', [CheckoutController::class, 'payInquiry']);
    Route::post('/merchant/orders/{order}/quote', [MerchantOrderController::class, 'provideQuote']);

    // Logistics
    Route::post('/delivery/confirm-pin', [DeliveryController::class, 'confirmPin']);

    // Post Interactions
    Route::post('/posts/{post}/comment', [PostController::class, 'storeComment'])->withTrashed();
    Route::post('/posts/{post}/like', [PostController::class, 'toggleLike'])->withTrashed();
    Route::post('/posts/{post}/react', [PostController::class, 'react'])->withTrashed();

    // Stock Waitlist
    Route::post('/products/{product}/waitlist', [WaitlistController::class, 'toggle']);
    Route::get('/products/{product}/waitlist/status', [WaitlistController::class, 'status']);

    // ─── ADMIN ──────────────────────────────────────────────────────────────
    Route::prefix('admin')->middleware('admin')->group(function () {
        // Disputes
        Route::get('/disputes', [AdminController::class, 'indexDisputes']);
        Route::post('/disputes/{dispute}/resolve', [AdminController::class, 'resolveDispute']);

        // Withdrawals
        Route::post('/withdrawals/{withdrawal}/approve', [AdminController::class, 'approveWithdrawal']);
        Route::get('/withdrawals', [AdminSettingsController::class, 'withdrawals']);

        // Settings & Platform Overview
        Route::get('/settings', [AdminSettingsController::class, 'index']);
        Route::put('/settings', [AdminSettingsController::class, 'update']);

        // Users & Merchants
        Route::get('/users', [AdminSettingsController::class, 'users']);
        Route::post('/users/{user}/toggle-role', [AdminSettingsController::class, 'toggleRole']);
        Route::post('/users/{user}/toggle-ban', [AdminSettingsController::class, 'toggleBan']);
        Route::get('/merchants', [AdminController::class, 'indexMerchants']);
        Route::get('/merchants/{merchant:id}', [AdminController::class, 'showMerchant']);
        Route::get('/merchants/{merchant:id}/products', [AdminController::class, 'merchantProducts']);
        Route::get('/merchants/{merchant:id}/posts', [AdminController::class, 'merchantPosts']);
        Route::get('/merchants/{merchant:id}/orders', [AdminController::class, 'merchantOrders']);
        Route::get('/merchants/{merchant:id}/catalog/{type}', [AdminController::class, 'merchantCatalogByType']);
        Route::post('/merchants/{merchant:id}/toggle-suspension', [AdminController::class, 'toggleSuspension']);
        Route::put('/merchants/{merchant:id}', [AdminController::class, 'updateMerchant']);
        Route::get('/feed', [AdminController::class, 'adminFeed']);
        Route::get('/posts/{postRef}', [AdminController::class, 'adminPostDetail']);
        Route::get('/search', [AdminController::class, 'globalSearch']);
        Route::get('/content-reports', [ContentReportModerationController::class, 'adminIndex']);
        Route::patch('/content-reports/{contentReport:id}/resolve', [ContentReportModerationController::class, 'adminResolve']);

        // Product category and attribute catalog management
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
});

// ─── PUBLIC STOREFRONT (Catch-all for merchant slugs) ────────────────────────
// These routes are at the bottom to avoid catching specific dashboard API segments.
$reservedMerchantSlugs = 'locations|shipping-profiles|shipping-zones|bundles|content-items|settings|dispatch|orders|posts|subscription-plans|wallet|chat|delivery';

Route::get('/merchant/{slug}', [MiniStoreController::class, 'show'])
    ->where('slug', "^(?!($reservedMerchantSlugs)$).+");

Route::get('/merchant/{slug}/shipping-zones', [MiniStoreController::class, 'shippingZones'])
    ->where('slug', "^(?!($reservedMerchantSlugs)$).+");

Route::post('/merchant/{slug}/storefront', [MiniStoreController::class, 'updateStorefront'])
    ->middleware('auth:sanctum');
