<?php

use App\Models\Order;
use App\Models\PulseNotification;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        PulseNotification::query()
            ->where('event_type', 'merchant_payment_completed')
            ->orderBy('id')
            ->chunkById(100, function ($events) {
                foreach ($events as $event) {
                    $order = $event->subject_type === Order::class
                        ? Order::query()->find($event->subject_id)
                        : null;

                    $earned = (float) ($order?->total_paid ?? 0);
                    $event->forceFill([
                        'body' => $earned > 0
                            ? 'Payment completed. You earned TZS '.number_format($earned).' from this order.'
                            : 'Payment completed. You earned from this order.',
                        'payload' => array_merge($event->payload ?: [], [
                            'earned' => $earned,
                            'currency' => 'TZS',
                        ]),
                    ])->save();
                }
            });
    }

    public function down(): void
    {
        //
    }
};
