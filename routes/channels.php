<?php

use App\Models\Order;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Used in Phase 7 for Merchant Dashboard Order alerts
Broadcast::channel('merchant.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id && $user->role === 'merchant';
});

// Phase 11: Safe-Chat strictly scoped to an Order
Broadcast::channel('chat.order.{id}', function ($user, $id) {
    $order = Order::find($id);
    if (!$order) {
        return false;
    }

    // Only buyer, merchant of the product, or admin can listen to this chat
    return (int) $user->id === (int) $order->buyer_id
        || (int) $user->id === (int) $order->product->merchant_id
        || $user->role === 'admin';
});
