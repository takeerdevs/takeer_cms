<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class ReleaseExpiredOrders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'orders:release-expired';
    protected $description = 'Release inventory from pending orders that have exceeded their expiration time.';

    public function handle()
    {
        $expiredOrders = \App\Models\Order::where('payment_status', 'pending')
            ->where('expires_at', '<', now())
            ->get();

        if ($expiredOrders->isEmpty()) {
            $this->info('No expired orders found.');
            return;
        }

        foreach ($expiredOrders as $order) {
            \Illuminate\Support\Facades\DB::transaction(function () use ($order) {
                $order->releaseInventory();
                $order->update(['payment_status' => 'failed']);
                
                if ($order->merchant?->user_id && $order->buyer_id) {
                    \App\Models\Message::create([
                        'order_id' => $order->id,
                        'sender_id' => $order->merchant->user_id,
                        'receiver_id' => $order->buyer_id,
                        'type' => 'system',
                        'body' => 'Hifadhi (stock) ya agizo hili imeachiwa kwa sababu malipo hayakukamilika kwa wakati.',
                        'payload' => [
                            'action_type' => 'order_payment_expired',
                            'occurred_at' => now()->toISOString(),
                        ],
                    ]);
                }
            });

            $this->info("Released inventory for Order #{$order->id}");
        }

        $this->info('Expiration processing complete.');
    }
}
