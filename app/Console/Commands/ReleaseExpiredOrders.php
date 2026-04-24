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
            ->where('is_inquiry', false) // Inquiries might have different rules, but usually they don't lock stock yet?
            // Actually, CheckoutController decrements stock even for physical products if they are initiated.
            ->get();

        // Note: In CheckoutController, inquire() does NOT decrement stock. 
        // But payInquiry() DOES decrement stock.
        // So we should target any order that is pending AND has expired.
        
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
                $order->update(['payment_status' => 'cancelled_expired']);
                
                // Add a system message to the chat
                \App\Models\Message::create([
                    'order_id' => $order->id,
                    'sender_id' => $order->merchant->user_id, // Merchant technically "releases" it
                    'type' => 'system',
                    'body' => 'Hifadhi (stock) ya agizo hili imeachiwa kwa sababu malipo hayakukamilika kwa wakati.',
                ]);
            });

            $this->info("Released inventory for Order #{$order->id}");
        }

        $this->info('Expiration processing complete.');
    }
}
