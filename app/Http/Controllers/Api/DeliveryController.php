<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Delivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryController extends Controller
{
    /**
     * POST /api/delivery/confirm-pin
     * Boda rider confirms the 4-digit PIN provided by the buyer.
     */
    public function confirmPin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
            'pin' => 'required|string|size:4',
        ]);

        $delivery = Delivery::where('order_id', $validated['order_id'])
            ->where('delivery_status', '!=', 'delivered')
            ->firstOrFail();

        if (
            ($delivery->buyer_release_pin && $delivery->buyer_release_pin !== $validated['pin']) &&
            ($delivery->pickup_pin && $delivery->pickup_pin !== $validated['pin'])
        ) {
            return response()->json(['message' => 'PIN si sahihi.'], 400);
        }

        // Release Escrow
        DB::transaction(function () use ($delivery) {
            $order = $delivery->order;

            // Mark as delivered
            $delivery->update(['delivery_status' => 'delivered']);

            // Release funds
            $order->update(['payment_status' => 'resolved_merchant_paid']);

            $merchantWallet = $order->product->merchant->user->wallet()->firstOrCreate(
                ['user_id' => $order->product->merchant->user_id],
                ['balance' => 0, 'frozen_balance' => 0]
            );
            $merchantWallet->decrement('frozen_balance', $order->total_paid);
            $merchantWallet->increment('balance', $order->total_paid * 0.95);
        });

        return response()->json([
            'message' => 'Delivery imethibitishwa. Pesa imeingizwa kwa muuzaji.',
        ]);
    }
}
