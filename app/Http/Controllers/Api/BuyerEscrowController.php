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

        $serviceRequest = \App\Models\ServiceRequest::query()
            ->where('payment_order_id', $order->id)
            ->first();

        if (!in_array($order->payment_status, ['escrow_locked', 'shipped'])) {
            return response()->json(['message' => 'Huwezi kudhibitisha oda hii kwa sasa.'], 400);
        }

        DB::transaction(function () use ($order, $serviceRequest) {
            $order->update(['payment_status' => 'resolved_merchant_paid']);
            if ($order->delivery) {
                $order->delivery->update(['delivery_status' => 'delivered', 'delivered_at' => now()]);
            }
            if ($serviceRequest) {
                $serviceRequest->update([
                    'payment_status' => 'released',
                    'delivery_status' => 'customer_confirmed',
                    'customer_confirmed_at' => now(),
                    'status' => 'completed',
                ]);
            }
            
            // Logic for wallet credits could be more complex, but using the pattern from DeliveryController
            $merchantUser = $order->merchant->user;
            $wallet = $merchantUser->wallet()->firstOrCreate(
                ['user_id' => $merchantUser->id],
                ['balance' => 0, 'frozen_balance' => 0]
            );
            $netAmount = \App\Models\Transaction::query()
                ->where('order_id', $order->id)
                ->where('type', 'order_revenue')
                ->latest()
                ->value('net_amount')
                ?? app(\App\Services\FeePolicyService::class)->calculateForOrder($order, (float) $order->total_paid)['net_amount'];
            
            $wallet->decrement('frozen_balance', $order->total_paid);
            $wallet->increment('balance', $netAmount);
        });

        return response()->json(['message' => $serviceRequest ? 'Asante! Umethibitisha huduma.' : 'Asante! Malipo yametumwa kwa muuzaji.']);
    }

    /**
     * POST /api/buyer/orders/{order}/dispute
     */
    public function fileDispute(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $serviceRequest = \App\Models\ServiceRequest::query()
            ->where('payment_order_id', $order->id)
            ->first();

        if (!in_array($order->payment_status, ['escrow_locked', 'shipped'])) {
            return response()->json(['message' => 'Huwezi kufungua file ya mgogoro kwa sasa.'], 400);
        }

        $validated = $request->validate([
            'unboxing_video' => 'nullable|file|mimetypes:video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,application/pdf|max:51200',
            'reason' => 'required|string|min:10',
        ]);

        $evidenceUrl = 'service-dispute-no-file';
        if ($request->hasFile('unboxing_video')) {
            $path = $request->file('unboxing_video')->store($serviceRequest ? 'service-disputes' : 'dispute-videos', 'public');
            $evidenceUrl = Storage::disk('public')->url($path);
        }

        DB::transaction(function () use ($order, $evidenceUrl, $validated, $serviceRequest) {
            $order->update(['payment_status' => 'disputed']);
            if ($serviceRequest) {
                $serviceRequest->update([
                    'payment_status' => 'disputed',
                    'delivery_status' => 'disputed',
                    'disputed_at' => now(),
                ]);
            }
            
            Dispute::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'buyer_unboxing_video_url' => $evidenceUrl,
                    'dispute_reason' => $validated['reason'],
                    'status' => 'open',
                ]
            );
        });

        return response()->json(['message' => 'Mgogoro umefunguliwa. Admin atafanya uchunguzi hivi punde.']);
    }
}
