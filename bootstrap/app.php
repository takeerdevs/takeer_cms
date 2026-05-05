<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        channels: __DIR__ . '/../routes/channels.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule) {
        $schedule->command('orders:release-expired')->everyMinute();
        $schedule->command('currency:update-rates')->dailyAt('03:15')->withoutOverlapping();
        $schedule->command('service-credentials:monitor-expiry')->dailyAt('04:15')->withoutOverlapping();
        $schedule->command('bundle-courses:log-reminders')->everyFifteenMinutes()->withoutOverlapping();
        $schedule->command('live-events:log-reminders')->everyFifteenMinutes()->withoutOverlapping();
        $schedule->command('marketing:sms-dispatch-scheduled')->everyMinute()->withoutOverlapping();
        $schedule->command('marketing:abandoned-checkouts-dispatch')->everyFifteenMinutes()->withoutOverlapping();
        $schedule->command('analytics:prune')->dailyAt('02:40')->withoutOverlapping();
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(prepend: [
            \App\Http\Middleware\CheckUserBan::class,
        ]);
        $middleware->api(prepend: [
            // Allow auth:sanctum to authenticate SPA requests via the web session cookie.
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
            \App\Http\Middleware\CheckUserBan::class,
        ]);
        $middleware->web(append: [
            \App\Http\Middleware\DetectUserCountry::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'merchant_status' => \App\Http\Middleware\CheckMerchantStatus::class,
            'own_merchant' => \App\Http\Middleware\EnsureUserOwnsMerchant::class,
            'retail_ops' => \App\Http\Middleware\EnsureRetailModuleActive::class,
            'retail_role' => \App\Http\Middleware\EnsureRetailStaffRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
