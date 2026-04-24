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
            // Instantly send the digital/service link to the buyer
            $buyerPhone = $order->buyer ? $order->buyer->phone_number : null;
            if ($buyerPhone) {
                $this->smsService->sendDigitalDeliveryNotification(
                    $buyerPhone,
                    $product->title,
                    $product->url,
                    $order->buyer_id
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
