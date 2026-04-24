<?php

namespace App\Events;

use App\Models\Message;
use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message, public Order $order)
    {
    }

    /**
     * Get the channels the event should broadcast on.
     * Creating a private channel for the specific order
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.order.' . $this->order->id),
        ];
    }
}
