<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Services\PickupAgreementService;
use Illuminate\Console\Command;

class CancelExpiredPickupOrders extends Command
{
    protected $signature = 'orders:cancel-expired-pickups {--limit=100 : Maximum orders to process in one run}';

    protected $description = 'Disabled legacy auto-cancellation for overdue self-pickup orders.';

    public function handle(PickupAgreementService $pickupAgreements): int
    {
        $this->info('Automatic pickup cancellation is disabled. Overdue pickup orders must be cancelled by merchant/admin after chat agreement or no-show review.');

        return self::SUCCESS;

        $limit = max(1, (int) $this->option('limit'));

        $orders = Order::query()
            ->with(['delivery', 'merchant.user', 'buyer', 'product'])
            ->whereNotNull('pickup_grace_ends_at')
            ->where('pickup_grace_ends_at', '<=', now())
            ->whereIn('payment_status', ['pending_fulfillment', 'payment_confirmed'])
            ->whereNull('pickup_completed_at')
            ->where(function ($query) {
                $query->whereNull('pickup_status')
                    ->orWhereIn('pickup_status', [
                        'ready_for_pickup',
                        'pickup_overdue',
                        'buyer_no_show',
                    ]);
            })
            ->whereHas('delivery', fn ($query) => $query->where('delivery_type', 'self_pickup'))
            ->orderBy('pickup_grace_ends_at')
            ->limit($limit)
            ->get();

        $processed = 0;

        foreach ($orders as $order) {
            $pickupAgreements->cancelAfterGrace($order, null, 'system', 'System cancelled after pickup deadline passed.');
            $processed++;
        }

        $this->info("Cancelled {$processed} expired pickup order(s).");

        return self::SUCCESS;
    }
}
