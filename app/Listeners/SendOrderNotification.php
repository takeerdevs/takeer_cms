<?php

namespace App\Listeners;

use App\Events\OrderPaid;
use App\Services\SmsService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class SendOrderNotification implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Create the event listener.
     */
    public function __construct(private SmsService $smsService)
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(OrderPaid $event): void
    {
        // Trigger the SMS asynchronously
        $order = $event->order;
        $merchant = $order->product->merchant;
        $product = $order->product;

        if ($product->isDigital() || $product->isService()) {
            // Instantly send the buyer back to their Orders access hub.
            $buyerPhone = $order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone;
            if ($buyerPhone) {
                $this->smsService->sendDigitalDeliveryNotification(
                    $buyerPhone,
                    $product->title,
                    url('/orders'),
                    $order->buyer_id,
                    'digital-delivery:'.($order->public_id ?: $order->id)
                );
            }
        } else {
            // Physical item: Notify the merchant to pack it.
            $this->smsService->sendOrderNotification(
                $merchant->phone_number,
                $order->id,
                $merchant->id
            );
        }
    }
}
