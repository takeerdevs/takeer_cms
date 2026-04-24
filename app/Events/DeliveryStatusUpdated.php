<?php

namespace App\Events;

use App\Models\Delivery;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryStatusUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Delivery $delivery;

    /**
     * Create a new event instance.
     */
    public function __construct(Delivery $delivery)
    {
        $this->delivery = $delivery;
    }

    /**
     * Get the channels the event should broadcast on.
     * Broadcast to the buyer's private channel.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('buyer.' . $this->delivery->order->buyer_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'delivery.updated';
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'order_id' => $this->delivery->order_id,
            'status' => $this->delivery->delivery_status,
            'bus_company' => $this->delivery->bus_company,
            'tracking' => $this->delivery->waybill_tracking_number,
            'boda_phone' => $this->delivery->boda_phone,
        ];
    }
}
