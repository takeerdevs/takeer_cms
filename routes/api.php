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
use App\Http\Controllers\Api\DiscoveryController;
use App\Http\Controllers\Api\DispatchController;
use App\Http\Controllers\Api\EntitlementController;
use App\Http\Controllers\Api\FeedController;
use App\Http\Controllers\Api\MerchantBundleController;
use App\Http\Controllers\Api\MerchantContentController;
use App\Http\Controllers\Api\MarketingEventController;
use App\Http\Controllers\Api\MerchantOrderController;
use App\Http\Controllers\Api\MerchantSubscriptionPlanController;
use App\Http\Controllers\Api\MiniStoreController;
use App\Http\Controllers\Api\PaymentWebhookController;
use App\Http\Controllers\Api\Payments\AzamPayCallbackController;
use App\Http\Controllers\Api\PlatformNotificationController;
use App\Http\Controllers\Api\ProductLicenseKeyController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\SecureAccessController;
use App\Http\Controllers\Api\ServiceCategoryController;
use App\Http\Controllers\Api\ServiceRequestController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\UnifiedSearchController;
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
Route::match(['get', 'post'], '/webhooks/social/comments', [\App\Http\Controllers\Api\MerchantMarketingController::class, 'receiveSocialWebhook'])
    ->middleware('throttle:240,1');
Route::match(['get', 'post'], '/webhooks/whatsapp', [\App\Http\Controllers\Api\MerchantMarketingController::class, 'receiveWhatsappWebhook'])
    ->middleware('throttle:240,1');

// ─── PUBLIC DISCOVERY ───────────────────────────────────────────────────────
Route::get('/feed', [FeedController::class, 'index']);
Route::get('/discovery/rails', [DiscoveryController::class, 'rails'])->middleware('throttle:45,1');
Route::post('/marketing/events', [MarketingEventController::class, 'store'])->middleware('throttle:120,1');
Route::post('/analytics/events', [MarketingEventController::class, 'store'])->middleware('throttle:120,1');
Route::get('/posts/{post}/comments', [PostController::class, 'comments'])->withTrashed();
Route::get('/pwa/product/{product}', [ProductController::class, 'show']);
Route::get('/pwa/post/{post}', [PostController::class, 'getPostData']);
Route::get('/content-items/{contentItem}', [CommerceCatalogController::class, 'showContentItem']);
Route::get('/bundles/{bundle}', [CommerceCatalogController::class, 'showBundle']);
Route::get('/subscription-plans/{subscriptionPlan}', [CommerceCatalogController::class, 'showSubscriptionPlan']);
Route::post('/retail-credit-payments/{publicId}/pay', [\App\Http\Controllers\Api\RetailCreditPaymentController::class, 'pay'])
    ->middleware('throttle:10,1');
Route::post('/retail-credit-payments/{publicId}/report', [\App\Http\Controllers\Api\RetailCreditPaymentController::class, 'report'])
    ->middleware('throttle:5,10');
Route::post('/service-requests', [ServiceRequestController::class, 'store'])
    ->middleware('throttle:8,1');
Route::post('/service-requests/intake-file', [ServiceRequestController::class, 'uploadIntakeFile'])
    ->middleware('throttle:12,1');
Route::get('/products/{product}/service-slots', [ServiceRequestController::class, 'productSlots'])
    ->middleware('throttle:30,1');
Route::get('/service-categories', [ServiceCategoryController::class, 'index'])
    ->middleware('throttle:60,1');
Route::post('/software/licenses/validate', [ProductLicenseKeyController::class, 'validateActivation'])
    ->middleware('throttle:30,1');

// ─── AI SEARCH ──────────────────────────────────────────────────────────────
Route::post('/search/text', [AiSearchController::class, 'textSearch'])->middleware('throttle:10,1');
Route::post('/search/visual', [AiSearchController::class, 'visualSearch'])->middleware('throttle:5,1');
Route::get('/search/unified/posts', [UnifiedSearchController::class, 'posts'])->middleware('throttle:45,1');

// ─── PROTECTED ROUTES ───────────────────────────────────────────────────────
// Guest Checkout accessible without auth
Route::post('/v1/checkout/initiate', [CheckoutController::class, 'initiate']);

Route::middleware('auth:sanctum')->group(function () {

    // Auth & Profile
    Route::get('/user', fn(Request $request) => $request->user());
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/profile/one-click/setup', [ProfileController::class, 'setupOneClick']);
    Route::post('/platform-notifications/dispatch', [PlatformNotificationController::class, 'dispatch'])
        ->middleware('throttle:30,1');

    // Buyer Checkout & Orders
    Route::post('/orders/{order}/complete', [CheckoutController::class, 'complete']);
    Route::post('/buyer/orders/{order}/confirm-receipt', [\App\Http\Controllers\Api\BuyerEscrowController::class, 'confirmReceipt']);
    Route::post('/buyer/orders/{order}/request-revision', [\App\Http\Controllers\Api\BuyerEscrowController::class, 'requestCustomRevision']);
    Route::post('/buyer/orders/{order}/dispute', [\App\Http\Controllers\Api\BuyerEscrowController::class, 'fileDispute']);
    Route::get('/orders/{order}/download', [\App\Http\Controllers\Api\DownloadController::class, 'download']);
    Route::post('/orders/{order}/send-download-link', [\App\Http\Controllers\Api\DownloadController::class, 'sendDownloadLink']);
    Route::get('/orders/{order}/download/local', [\App\Http\Controllers\Api\DownloadController::class, 'downloadLocal'])->name('api.download.local');
    Route::get('/orders/{order}/license-file', [ProductLicenseKeyController::class, 'downloadOfflineLicense'])
        ->name('api.orders.license-file');
    Route::post('/content-items/{contentItem:id}/access-link', [SecureAccessController::class, 'contentAccessLink']);
    Route::get('/content-items/{contentItem:id}/secure-body', [SecureAccessController::class, 'contentBody'])->name('api.content-items.secure-body');
    Route::post('/bundle-items/{bundleItem:id}/materials/{materialIndex}/access-link', [SecureAccessController::class, 'bundleItemMaterialAccessLink']);
    Route::post('/bundle-lesson-assets/{asset:id}/access-link', [SecureAccessController::class, 'bundleLessonAssetAccessLink']);
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
        Route::put('/settings', [\App\Http\Controllers\Api\MerchantSettingsController::class, 'update'])->middleware('merchant_permission:settings.update');
        Route::post('/products/{product}/sync', [ProductController::class, 'syncStock'])->middleware('merchant_permission:products.manage_stock');
        Route::post('/dispatch/{order}/intercity', [DispatchController::class, 'intercity'])->middleware('merchant_permission:orders.dispatch');
        Route::post('/dispatch/{order}/local', [DispatchController::class, 'local'])->middleware('merchant_permission:orders.dispatch');
        Route::get('/content-items', [MerchantContentController::class, 'index'])->middleware('merchant_permission:digital_products.view');
        Route::post('/content-items', [MerchantContentController::class, 'store'])->middleware('merchant_permission:digital_products.create');
        Route::get('/content-items/{contentItem:id}', [MerchantContentController::class, 'show'])->middleware('merchant_permission:digital_products.view');
        Route::put('/content-items/{contentItem:id}', [MerchantContentController::class, 'update'])->middleware('merchant_permission:digital_products.update');
        Route::delete('/content-items/{contentItem:id}', [MerchantContentController::class, 'destroy'])->middleware('merchant_permission:digital_products.delete');
        Route::get('/posts', [MerchantContentController::class, 'posts'])->middleware('merchant_permission:posts.view');
        Route::patch('/posts/{post:id}/interaction', [MerchantContentController::class, 'updatePostInteraction'])->middleware('merchant_permission:posts.update');

        Route::get('/bundles', [MerchantBundleController::class, 'index'])->middleware('merchant_permission:bundles.view');
        Route::post('/bundles', [MerchantBundleController::class, 'store'])->middleware('merchant_permission:bundles.create');
        Route::get('/bundles/{bundle:id}', [MerchantBundleController::class, 'show'])->middleware('merchant_permission:bundles.view');
        Route::put('/bundles/{bundle:id}', [MerchantBundleController::class, 'update'])->middleware('merchant_permission:bundles.update');
        Route::delete('/bundles/{bundle:id}', [MerchantBundleController::class, 'destroy'])->middleware('merchant_permission:bundles.delete');

        // Merchant Order PIN Verification
        Route::post('/{merchant:username}/order-checkup/lookup', [MerchantOrderController::class, 'checkupLookup'])->middleware('merchant_permission:orders.verify_pickup');
        Route::post('/{merchant:username}/orders/{order:id}/verify-pickup', [MerchantOrderController::class, 'verifyPickup'])->middleware('merchant_permission:orders.verify_pickup');
        Route::post('/{merchant:username}/orders/{order:id}/verify-delivery', [MerchantOrderController::class, 'verifyDelivery'])->middleware('merchant_permission:orders.verify_pickup');
        Route::post('/{merchant:username}/orders/{order:id}/extend-lock', [MerchantOrderController::class, 'extendExpiration'])->middleware('merchant_permission:orders.update');
        Route::post('/{merchant:username}/orders/{order:id}/release-inventory', [MerchantOrderController::class, 'releaseInventory'])->middleware('merchant_permission:orders.update');
        Route::post('/{merchant:username}/dispatch/{order:id}/{mode}', [MerchantOrderController::class, 'dispatchOrder'])->middleware('merchant_permission:orders.dispatch');

        Route::get('/subscription-plans', [MerchantSubscriptionPlanController::class, 'index'])->middleware('merchant_permission:subscriptions.view');
        Route::post('/subscription-plans', [MerchantSubscriptionPlanController::class, 'store'])->middleware('merchant_permission:subscriptions.create');
        Route::get('/subscription-plans/{subscriptionPlan:id}', [MerchantSubscriptionPlanController::class, 'show'])->middleware('merchant_permission:subscriptions.view');
        Route::put('/subscription-plans/{subscriptionPlan:id}', [MerchantSubscriptionPlanController::class, 'update'])->middleware('merchant_permission:subscriptions.update');
        Route::delete('/subscription-plans/{subscriptionPlan:id}', [MerchantSubscriptionPlanController::class, 'destroy'])->middleware('merchant_permission:subscriptions.delete');
        Route::get('/subscription-plans/{subscriptionPlan:id}/community-posts', [MerchantSubscriptionPlanController::class, 'communityPosts'])->middleware('merchant_permission:subscriptions.view');
        Route::post('/subscription-plans/{subscriptionPlan:id}/community-posts', [MerchantSubscriptionPlanController::class, 'storeCommunityPost'])->middleware('merchant_permission:subscriptions.update');
        Route::delete('/subscription-plans/{subscriptionPlan:id}/community-posts/{post:id}', [MerchantSubscriptionPlanController::class, 'destroyCommunityPost'])->middleware('merchant_permission:subscriptions.update');
        
        Route::get('/shipping-profiles', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'index'])->middleware('merchant_permission:settings.view');
        Route::post('/shipping-profiles', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'store'])->middleware('merchant_permission:settings.update');
        Route::put('/shipping-profiles/{shippingProfile:id}', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'update'])->middleware('merchant_permission:settings.update');
        Route::delete('/shipping-profiles/{shippingProfile:id}', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'destroy'])->middleware('merchant_permission:settings.update');
        Route::post('/shipping-profiles/{shippingProfile:id}/set-default', [\App\Http\Controllers\Api\MerchantShippingProfileController::class, 'setDefault'])->middleware('merchant_permission:settings.update');

        Route::get('/return-policies', [\App\Http\Controllers\Api\MerchantReturnPolicyController::class, 'index'])->middleware('merchant_permission:settings.view');
        Route::post('/return-policies', [\App\Http\Controllers\Api\MerchantReturnPolicyController::class, 'store'])->middleware('merchant_permission:settings.update');
        Route::put('/return-policies/{returnPolicy:id}', [\App\Http\Controllers\Api\MerchantReturnPolicyController::class, 'update'])->middleware('merchant_permission:settings.update');
        Route::delete('/return-policies/{returnPolicy:id}', [\App\Http\Controllers\Api\MerchantReturnPolicyController::class, 'destroy'])->middleware('merchant_permission:settings.update');
        Route::post('/return-policies/{returnPolicy:id}/set-default', [\App\Http\Controllers\Api\MerchantReturnPolicyController::class, 'setDefault'])->middleware('merchant_permission:settings.update');

        Route::get('/shipping-profiles/{shippingProfile:id}/zones', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'index'])->middleware('merchant_permission:settings.view');
        Route::post('/shipping-profiles/{shippingProfile:id}/zones', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'store'])->middleware('merchant_permission:settings.update');
        Route::put('/shipping-zones/{shippingZone:id}', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'update'])->middleware('merchant_permission:settings.update');
        Route::delete('/shipping-zones/{shippingZone:id}', [\App\Http\Controllers\Api\MerchantShippingZoneController::class, 'destroy'])->middleware('merchant_permission:settings.update');

        Route::get('/content-reports', [ContentReportModerationController::class, 'merchantIndex'])->middleware('merchant_permission:posts.view');
        Route::patch('/content-reports/{contentReport:id}/resolve', [ContentReportModerationController::class, 'merchantResolve'])->middleware('merchant_permission:posts.update');
        Route::post('/content-reports/{contentReport:id}/appeal', [ContentReportModerationController::class, 'merchantAppeal'])->middleware('merchant_permission:posts.update');
    });

    // Merchant Locations (outside merchant_status to avoid binding issues)
    Route::prefix('merchant')->group(function () {
        Route::get('/locations', [\App\Http\Controllers\Api\MerchantLocationController::class, 'index'])->middleware('merchant_permission:settings.view');
        Route::post('/locations', [\App\Http\Controllers\Api\MerchantLocationController::class, 'store'])->middleware('merchant_permission:settings.update');
        Route::put('/locations/{merchantLocation:id}', [\App\Http\Controllers\Api\MerchantLocationController::class, 'update'])->middleware('merchant_permission:settings.update');
        Route::delete('/locations/{merchantLocation:id}', [\App\Http\Controllers\Api\MerchantLocationController::class, 'destroy'])->middleware('merchant_permission:settings.update');
    });

    // Phase 11 Safe-Chat
    Route::get('/chat/order/{order}/messages', [ChatController::class, 'index']);
    Route::post('/chat/order/{order}/messages', [ChatController::class, 'store']);
    Route::get('/chat/order/{order}/search-products', [ChatController::class, 'merchantProducts']);
    Route::post('/media/upload', [UploadController::class, 'uploadMedia']);

    // Shipping Inquiries
    Route::post('/v1/checkout/inquire', [CheckoutController::class, 'inquire']);
    Route::post('/v1/checkout/pay-inquiry/{order}', [CheckoutController::class, 'payInquiry']);
    Route::post('/merchant/orders/{order}/quote', [MerchantOrderController::class, 'provideQuote'])->middleware('merchant_permission:orders.update');

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
        Route::get('/custom-delivery-events/{event}/download', [AdminController::class, 'downloadCustomDeliveryEvent']);
        Route::post('/disputes/{dispute}/trust-safety', [AdminController::class, 'handleTrustSafetyDispute']);
        Route::get('/trust-safety-reviews', [AdminController::class, 'indexTrustSafetyReviews']);
        Route::post('/trust-safety-reviews/{review}', [AdminController::class, 'resolveTrustSafetyReview']);

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
        Route::put('/merchants/{merchant:id}/settings', [AdminController::class, 'updateMerchantSettings']);
        Route::get('/merchants/{merchant:id}/products', [AdminController::class, 'merchantProducts']);
        Route::get('/services', [AdminController::class, 'services']);
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
        Route::get('/service-categories', [ServiceCategoryController::class, 'index']);
        Route::post('/service-categories', [ServiceCategoryController::class, 'store']);
        Route::put('/service-categories/{serviceCategory}', [ServiceCategoryController::class, 'update']);
        Route::delete('/service-categories/{serviceCategory}', [ServiceCategoryController::class, 'destroy']);

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
        Route::get('/catalog/brand-models/{brandModel}', [AdminCatalogController::class, 'updateBrandModel']);
        Route::delete('/catalog/brand-models/{brandModel}', [AdminCatalogController::class, 'destroyBrandModel']);
    });

    // ─── RETAIL OPS MODULE ──────────────────────────────────────────────────
    Route::post('/merchant/modules/retail-ops/activate', [\App\Http\Controllers\Api\RetailModuleController::class, 'activate'])->middleware('merchant_permission:settings.update');
    Route::post('/merchant/modules/retail-ops/deactivate', [\App\Http\Controllers\Api\RetailModuleController::class, 'deactivate'])->middleware('merchant_permission:settings.update');

    Route::middleware(['retail_ops'])->prefix('retail')->group(function () {
        // Staff Management
        Route::get('/staff', [\App\Http\Controllers\Api\MerchantStaffController::class, 'index'])->middleware('merchant_permission:team.view');
        Route::post('/staff', [\App\Http\Controllers\Api\MerchantStaffController::class, 'store'])->middleware('merchant_permission:team.create');
        Route::patch('/staff/{staff}', [\App\Http\Controllers\Api\MerchantStaffController::class, 'update'])->middleware('merchant_permission:team.update');
        Route::patch('/staff/{staff}/reset-pin', [\App\Http\Controllers\Api\MerchantStaffController::class, 'resetPin'])->middleware('merchant_permission:team.reset_pin');
        Route::post('/staff/{staff}/clear-devices', [\App\Http\Controllers\Api\MerchantStaffController::class, 'clearDevices'])->middleware('merchant_permission:team.clear_devices');
        Route::delete('/staff/{staff}', [\App\Http\Controllers\Api\MerchantStaffController::class, 'destroy'])->middleware('merchant_permission:team.delete');

        // Dashboard & Audit
        Route::get('/dashboard', [\App\Http\Controllers\Api\RetailDashboardController::class, 'index'])->middleware('merchant_permission:retail.dashboard');
        Route::get('/audit-logs', [\App\Http\Controllers\Api\RetailDashboardController::class, 'auditLogs'])->middleware('merchant_permission:retail.dashboard,team.view');
        Route::get('/bookkeeping', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'index'])->middleware('merchant_permission:bookkeeping.view');
        Route::post('/bookkeeping', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'store'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/{entry}/void', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'void'])->middleware('merchant_permission:bookkeeping.void');
        Route::post('/bookkeeping/{entry}/review', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'review'])->middleware('merchant_permission:bookkeeping.review');
        Route::post('/bookkeeping/{entry}/reconcile', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'reconcile'])->middleware('merchant_permission:bookkeeping.reconcile');
        Route::put('/bookkeeping/{entry}', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'update'])->middleware('merchant_permission:bookkeeping.update');
        Route::get('/bookkeeping/export', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'export'])->middleware('merchant_permission:bookkeeping.export');
        Route::get('/bookkeeping/audit-pack', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'auditPack'])->middleware('merchant_permission:bookkeeping.export');
        Route::get('/bookkeeping/reports/{report}', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'exportReport'])->middleware('merchant_permission:bookkeeping.export');
        Route::get('/bookkeeping/tax-wizards/{wizard}/export', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'exportTaxWizard'])->middleware('merchant_permission:bookkeeping.export');
        Route::get('/bookkeeping/report-pack', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'reportPack'])->middleware('merchant_permission:bookkeeping.export');
        Route::post('/bookkeeping/opening-balance', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'openingBalanceStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/account-items', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'accountItemStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/account-items/{item}/settle', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'accountItemSettle'])->middleware('merchant_permission:bookkeeping.update');
        Route::post('/bookkeeping/account-items/{item}/void', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'accountItemVoid'])->middleware('merchant_permission:bookkeeping.void');
        Route::post('/bookkeeping/adjustments', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'adjustmentStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/statements/import', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'statementImport'])->middleware('merchant_permission:bookkeeping.reconcile');
        Route::post('/bookkeeping/statements/manual', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'statementStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/statements/{line}/match', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'statementMatch'])->middleware('merchant_permission:bookkeeping.reconcile');
        Route::post('/bookkeeping/statements/{line}/ignore', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'statementIgnore'])->middleware('merchant_permission:bookkeeping.reconcile');
        Route::post('/bookkeeping/obligations', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'obligationStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/obligations/{obligation}/complete', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'obligationComplete'])->middleware('merchant_permission:bookkeeping.update');
        Route::post('/bookkeeping/recurring-bills', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'recurringBillStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/recurring-bills/{bill}/pay', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'recurringBillPay'])->middleware('merchant_permission:bookkeeping.update');
        Route::post('/bookkeeping/payroll', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'payrollStore'])->middleware('merchant_permission:bookkeeping.create');
        Route::post('/bookkeeping/payroll/{payroll}/pay', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'payrollPay'])->middleware('merchant_permission:bookkeeping.update');
        Route::post('/bookkeeping/share-links', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'shareLinkStore'])->middleware('merchant_permission:bookkeeping.export');
        Route::post('/bookkeeping/share-links/{shareLink}/revoke', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'shareLinkRevoke'])->middleware('merchant_permission:bookkeeping.export');
        Route::post('/bookkeeping/period-locks', [\App\Http\Controllers\Api\RetailBookkeepingController::class, 'lockPeriod'])->middleware('merchant_permission:bookkeeping.lock_period');
        Route::get('/fiscal-integrations', [\App\Http\Controllers\Api\MerchantFiscalIntegrationController::class, 'index'])->middleware('merchant_permission:bookkeeping.view');
        Route::post('/fiscal-integrations', [\App\Http\Controllers\Api\MerchantFiscalIntegrationController::class, 'store'])->middleware('merchant_permission:bookkeeping.update');
        Route::get('/fiscal-receipts', [\App\Http\Controllers\Api\MerchantFiscalIntegrationController::class, 'receipts'])->middleware('merchant_permission:bookkeeping.view');
        Route::post('/fiscal-receipts/{receipt}/retry', [\App\Http\Controllers\Api\MerchantFiscalIntegrationController::class, 'retry'])->middleware('merchant_permission:bookkeeping.update');
        Route::get('/trust-safety', [\App\Http\Controllers\Api\RetailDashboardController::class, 'trustSafety'])->middleware('merchant_permission:retail.settings,settings.view');
        Route::post('/trust-safety/review-request', [\App\Http\Controllers\Api\RetailDashboardController::class, 'requestTrustSafetyReview'])->middleware('merchant_permission:retail.settings,settings.update');
        Route::get('/outstanding-balances', [\App\Http\Controllers\Api\RetailDashboardController::class, 'outstandingBalances'])->middleware('merchant_permission:retail.outstanding');
        Route::post('/outstanding-balances/{order}/payment-link', [\App\Http\Controllers\Api\RetailDashboardController::class, 'outstandingPaymentLink'])->middleware('merchant_permission:retail.outstanding');
        Route::post('/outstanding-balances/{order}/settle', [\App\Http\Controllers\Api\RetailDashboardController::class, 'settleOutstanding'])->middleware('merchant_permission:retail.outstanding');

        // Stock Transfers (Handshake)
        Route::get('/transfers', [\App\Http\Controllers\Api\StockTransferController::class, 'index'])->middleware('merchant_permission:retail.transfers');
        Route::get('/products/{product:id}/timeline', [\App\Http\Controllers\Api\StockTransferController::class, 'productTimeline'])->middleware('merchant_permission:retail.inventory');
        Route::post('/transfers', [\App\Http\Controllers\Api\StockTransferController::class, 'store'])->middleware('merchant_permission:retail.transfers');
        Route::patch('/transfers/{transfer}/dispatch', [\App\Http\Controllers\Api\StockTransferController::class, 'dispatch'])->middleware('merchant_permission:retail.transfers');
        Route::patch('/transfers/{transfer}/receive', [\App\Http\Controllers\Api\StockTransferController::class, 'receive'])->middleware('merchant_permission:retail.transfers');
        Route::patch('/transfers/{transfer}/cancel', [\App\Http\Controllers\Api\StockTransferController::class, 'cancel'])->middleware('merchant_permission:retail.transfers');

        // POS Operations
        Route::get('/pos/products', [\App\Http\Controllers\Api\PosController::class, 'searchProducts'])->middleware('merchant_permission:retail.pos');
        Route::post('/pos/sale', [\App\Http\Controllers\Api\PosController::class, 'storeSale'])->middleware('merchant_permission:retail.sale');
        Route::post('/pos/sale/{order}/void', [\App\Http\Controllers\Api\PosController::class, 'voidSale'])->middleware('merchant_permission:retail.void_sale');
        Route::post('/pos/sale/{order}/approve', [\App\Http\Controllers\Api\PosController::class, 'approveOrder'])->middleware('merchant_permission:retail.approve_sale');
        Route::post('/pos/sale/{order}/reject', [\App\Http\Controllers\Api\PosController::class, 'rejectOrder'])->middleware('merchant_permission:retail.approve_sale');
        Route::post('/pos/lookup', [\App\Http\Controllers\Api\PosController::class, 'findOrderByCode'])->middleware('merchant_permission:retail.pos,retail.inventory');
        Route::get('/pos/pending', [\App\Http\Controllers\Api\PosController::class, 'pendingOrders'])->middleware('merchant_permission:retail.pos,retail.inventory');

        // Inventory Management
        Route::get('/inventory', [\App\Http\Controllers\Api\RetailInventoryController::class, 'index'])->middleware('merchant_permission:retail.inventory');
        Route::post('/inventory/restock', [\App\Http\Controllers\Api\RetailInventoryController::class, 'restock'])->middleware('merchant_permission:retail.inventory');
        Route::post('/inventory/count', [\App\Http\Controllers\Api\RetailInventoryController::class, 'submitCount'])->middleware('merchant_permission:retail.inventory');
        Route::post('/inventory/import', [\App\Http\Controllers\Api\RetailInventoryController::class, 'bulkImport'])->middleware('merchant_permission:retail.inventory');

        // Onboarding
        Route::post('/onboarding/import', [\App\Http\Controllers\Api\RetailOnboardingController::class, 'import'])->middleware('merchant_permission:retail.inventory');

        // Customer Management
        Route::get('/customers', [\App\Http\Controllers\Api\MerchantCustomerController::class, 'index'])->middleware('merchant_permission:retail.customers');
        Route::get('/customers/{customer}', [\App\Http\Controllers\Api\MerchantCustomerController::class, 'show'])->middleware('merchant_permission:retail.customers');

        // Retail Settings
        Route::get('/settings', [\App\Http\Controllers\Api\PosController::class, 'getSettings'])->middleware('merchant_permission:retail.settings');
        Route::patch('/settings', [\App\Http\Controllers\Api\PosController::class, 'updateSettings'])->middleware('merchant_permission:retail.settings');
    });

    // POS Terminal Auth (Does not need retail_ops middleware here as it checks staff status internally)
    Route::post('/retail/staff/pin-login', [\App\Http\Controllers\Api\StaffAuthController::class, 'pinLogin'])->middleware('throttle:5,10');
    Route::post('/retail/staff/pin-override', [\App\Http\Controllers\Api\StaffAuthController::class, 'pinOverride']);
});

// ─── PUBLIC STOREFRONT (Catch-all for merchant slugs) ────────────────────────
// These routes are at the bottom to avoid catching specific dashboard API segments.
$reservedMerchantSlugs = 'locations|shipping-profiles|shipping-zones|bundles|content-items|settings|dispatch|orders|posts|subscription-plans|wallet|chat|delivery';

Route::get('/merchant/{slug}/catalog', [MiniStoreController::class, 'catalog'])
    ->where('slug', "^(?!($reservedMerchantSlugs)$).+");

Route::get('/merchant/{slug}/shipping-zones', [MiniStoreController::class, 'shippingZones'])
    ->where('slug', "^(?!($reservedMerchantSlugs)$).+");

Route::post('/merchant/{slug}/storefront', [MiniStoreController::class, 'updateStorefront'])
    ->middleware('auth:sanctum');

Route::get('/merchant/{slug}', [MiniStoreController::class, 'show'])
    ->where('slug', "^(?!($reservedMerchantSlugs)$).+");
