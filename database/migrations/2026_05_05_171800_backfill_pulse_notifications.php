<?php

use App\Models\Order;
use App\Models\UserSubscription;
use App\Services\PulseNotificationService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $service = app(PulseNotificationService::class);

        Order::query()
            ->whereNotNull('buyer_id')
            ->with(['product', 'merchant', 'delivery'])
            ->orderBy('id')
            ->chunkById(100, function ($orders) use ($service) {
                foreach ($orders as $order) {
                    $service->backfillOrder($order);
                }
            });

        UserSubscription::query()
            ->with(['plan', 'merchant'])
            ->orderBy('id')
            ->chunkById(100, function ($subscriptions) use ($service) {
                foreach ($subscriptions as $subscription) {
                    $service->subscriptionStarted($subscription);
                }
            });
    }

    public function down(): void
    {
        // Pulse rows are append-only notification history; leave them intact on rollback.
    }
};
