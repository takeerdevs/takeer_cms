<?php

namespace App\Jobs;

use App\Models\Delivery;
use App\Models\Order;
use App\Services\SmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DispatchCourier implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct(public Order $order)
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(SmsService $smsService): void
    {
        // This job handles the "local_boda" logic automatically.
        // If the merchant handles dispatch themselves (intercity), they use the DispatchController.

        $zone = $this->order->product->merchant->shippingZones()
            ->where('id', $this->order->buyer->oneClickProfile?->delivery_zone_id)
            ->first();

        // If it's a local boda delivery zone, auto-assign a mock boda rider
        if ($zone && $zone->delivery_type === 'local_boda') {

            // Assign dummy boda
            $bodaPhones = ['+255712345678', '+255789123456', '+255755112233'];
            $bodaPhone = $bodaPhones[array_rand($bodaPhones)];

            // Ensure order is locked in escrow
            $this->order->update(['payment_status' => 'escrow_locked']);

            // Gen PIN
            $pin = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);

            $delivery = Delivery::create([
                'order_id' => $this->order->id,
                'delivery_status' => 'in_transit',
                'buyer_release_pin' => $pin,
                'boda_phone' => $bodaPhone,
            ]);

            // Alert the buyer
            $smsService->sendDispatchNotification(
                $this->order->buyer->phone_number,
                'Local Delivery Rider',
                'N/A',
                $pin,
                $this->order->buyer_id
            );

            // Fire DeliveryStatusUpdated event for Buyer Reverb 
            event(new \App\Events\DeliveryStatusUpdated($delivery));
        }
    }
}
