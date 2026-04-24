<?php

namespace App\Providers;

use App\Payments\Drivers\AzamPay\AzamPayGateway;
use App\Payments\Drivers\AzamPay\AzamPayTokenService;
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
    }
}
