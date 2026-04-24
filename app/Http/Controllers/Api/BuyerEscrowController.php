<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BuyerEscrowController extends Controller
{
    /**
     * POST /api/buyer/orders/{order}/confirm-receipt
     */
    public function confirmReceipt(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!in_array($order->payment_status, ['escrow_locked', 'shipped'])) {
            return response()->json(['message' => 'Huwezi kudhibitisha oda hii kwa sasa.'], 400);
        }

        DB::transaction(function () use ($order) {
            $order->update(['payment_status' => 'resolved_merchant_paid']);
            if ($order->delivery) {
                $order->delivery->update(['delivery_status' => 'delivered', 'delivered_at' => now()]);
            }
            
            // Logic for wallet credits could be more complex, but using the pattern from DeliveryController
            $merchantUser = $order->merchant->user;
            $wallet = $merchantUser->wallet()->firstOrCreate(
                ['user_id' => $merchantUser->id],
                ['balance' => 0, 'frozen_balance' => 0]
            );
            
            $wallet->decrement('frozen_balance', $order->total_paid);
            $wallet->increment('balance', $order->total_paid * 0.95); // Assuming 5% platform fee
        });

        return response()->json(['message' => 'Asante! Malipo yametumwa kwa muuzaji.']);
    }

    /**
     * POST /api/buyer/orders/{order}/dispute
     */
    public function fileDispute(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!in_array($order->payment_status, ['escrow_locked', 'shipped'])) {
            return response()->json(['message' => 'Huwezi kufungua file ya mgogoro kwa sasa.'], 400);
        }

        $validated = $request->validate([
            'unboxing_video' => 'required|file|mimetypes:video/mp4,video/quicktime,video/webm|max:51200',
            'reason' => 'required|string|min:10',
        ]);

        $path = $request->file('unboxing_video')->store('dispute-videos', 'public');
        $videoUrl = Storage::disk('public')->url($path);

        DB::transaction(function () use ($order, $videoUrl, $validated) {
            $order->update(['payment_status' => 'disputed']);
            
            Dispute::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'buyer_unboxing_video_url' => $videoUrl,
                    'dispute_reason' => $validated['reason'],
                    'status' => 'open',
                ]
            );
        });

        return response()->json(['message' => 'Mgogoro umefunguliwa. Admin atafanya uchunguzi hivi punde.']);
    }
}
