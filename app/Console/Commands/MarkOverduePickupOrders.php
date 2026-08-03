<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\PickupAgreementService;
use Illuminate\Console\Command;

class MarkOverduePickupOrders extends Command
{
    protected $signature = 'orders:mark-overdue-pickups {--limit=100 : Maximum orders to process in one run}';

    protected $description = 'Record pickup orders whose free pickup window has expired so grace/late-fee handling can begin.';

    public function handle(PickupAgreementService $pickupAgreements): int
    {
        $limit = max(1, (int) $this->option('limit'));

        $orders = Order::query()
            ->with(['delivery', 'merchant.user', 'buyer'])
            ->whereNotNull('pickup_deadline_at')
            ->where('pickup_deadline_at', '<=', now())
            ->whereIn('payment_status', ['pending_fulfillment', 'payment_confirmed'])
            ->where(function ($query) {
                $query->whereNull('pickup_status')
                    ->orWhereIn('pickup_status', [
                        'ready_for_pickup',
                        'extension_requested',
                    ]);
            })
            ->whereHas('delivery', fn ($query) => $query->where('delivery_type', 'self_pickup'))
            ->orderBy('pickup_deadline_at')
            ->limit($limit)
            ->get();

        $processed = 0;

        foreach ($orders as $order) {
            $pickupAgreements->markOverdue($order);
            $processed++;
        }

        $this->info("Marked {$processed} overdue pickup order(s).");

        return self::SUCCESS;
    }
}
