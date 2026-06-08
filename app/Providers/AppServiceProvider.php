<?php

namespace App\Providers;

use App\Payments\Drivers\AzamPay\AzamPayGateway;
use App\Payments\Drivers\AzamPay\AzamPayTokenService;
use App\Payments\Drivers\Selcom\SelcomClient;
use App\Payments\Drivers\Selcom\SelcomGateway;
use App\Observers\MerchantAuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // ─── AzamPay (Tanzania) ──────────────────────────────────────────────────
        $this->app->singleton(AzamPayTokenService::class, function () {
            return new AzamPayTokenService(
                authenticatorBaseUrl: config('services.azampay.authenticator_base_url'),
                clientId:            config('services.azampay.client_id'),
                clientSecret:        config('services.azampay.client_secret'),
                appName:             config('services.azampay.app_name'),
            );
        });

        $this->app->singleton(AzamPayGateway::class, function ($app) {
            return new AzamPayGateway(
                tokenService:    $app->make(AzamPayTokenService::class),
                checkoutBaseUrl: config('services.azampay.checkout_base_url'),
                apiKey:          config('services.azampay.token'),
            );
        });

        $this->app->singleton(SelcomClient::class, function () {
            return new SelcomClient(
                baseUrl: (string) config('services.selcom.base_url'),
                apiKey: (string) config('services.selcom.api_key'),
                apiSecret: (string) config('services.selcom.api_secret'),
            );
        });

        $this->app->singleton(SelcomGateway::class, function ($app) {
            return new SelcomGateway(
                client: $app->make(SelcomClient::class),
                displayDirectory: $app->make(\App\Services\PaymentDisplayDirectory::class),
                vendor: (string) config('services.selcom.vendor'),
                callbackUrl: (string) config('services.selcom.callback_url'),
                simulate: (bool) config('services.selcom.simulate'),
            );
        });

        // ─── Future gateways — add bindings here as you expand ──────────────────
        // $this->app->singleton(MpesaKeGateway::class, function ($app) { ... });
        // $this->app->singleton(FlutterwaveGateway::class, function ($app) { ... });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \App\Models\Product::observe(\App\Observers\InventoryObserver::class);
        \App\Models\ProductVariant::observe(\App\Observers\InventoryObserver::class);

        foreach ([
            \App\Models\Bundle::class,
            \App\Models\ContentItem::class,
            \App\Models\MerchantCoupon::class,
            \App\Models\MerchantGroupSaleCampaign::class,
            \App\Models\MerchantLocation::class,
            \App\Models\MerchantReturnPolicy::class,
            \App\Models\MerchantSocialDmCampaign::class,
            \App\Models\MerchantWhatsappAutomation::class,
            \App\Models\PaymentPage::class,
            \App\Models\Post::class,
            \App\Models\Product::class,
            \App\Models\ShippingProfile::class,
            \App\Models\SubscriptionPlan::class,
        ] as $model) {
            $model::observe(MerchantAuditObserver::class);
        }
    }
}
