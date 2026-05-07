<?php

use App\Models\Order;
use App\Models\ProductReview;
use App\Services\PulseNotificationService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $service = app(PulseNotificationService::class);

        Order::query()
            ->whereNotNull('buyer_id')
            ->with(['product', 'merchant.user', 'buyer', 'delivery'])
            ->orderBy('id')
            ->chunkById(100, function ($orders) use ($service) {
                foreach ($orders as $order) {
                    $service->backfillOrder($order);
                }
            });

        ProductReview::query()
            ->with(['product.merchant.user', 'user', 'order'])
            ->orderBy('id')
            ->chunkById(100, function ($reviews) use ($service) {
                foreach ($reviews as $review) {
                    $service->reviewCreated($review);
                }
            });
    }

    public function down(): void
    {
        //
    }
};
