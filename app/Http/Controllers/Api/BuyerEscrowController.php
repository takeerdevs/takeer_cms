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
            if ($order->product?->isDigital() && ($order->product?->digital_delivery_type ?? null) === 'custom_delivery') {
                $order->forceFill([
                    'custom_delivery_status' => 'accepted',
                    'custom_delivery_accepted_at' => now(),
                ])->save();
            }
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

            app(\App\Services\WalletService::class)->releaseEscrowToMerchant($order);
        });

        return response()->json(['message' => $serviceRequest ? 'Asante! Umethibitisha huduma.' : 'Asante! Malipo yametumwa kwa muuzaji.']);
    }

    public function requestCustomRevision(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $order->loadMissing('product');
        if (! $order->product?->isDigital() || ($order->product?->digital_delivery_type ?? null) !== 'custom_delivery') {
            return response()->json(['message' => 'This order is not a custom digital delivery.'], 422);
        }

        if ($order->payment_status !== 'escrow_locked') {
            return response()->json(['message' => 'Revision requests are only available while payment is held.'], 400);
        }

        if (! $order->custom_delivery_delivered_at) {
            return response()->json(['message' => 'The merchant has not delivered a file yet.'], 400);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'min:10', 'max:3000'],
        ]);

        $order->update([
            'custom_delivery_status' => 'revision_requested',
            'custom_delivery_revision_message' => $validated['message'],
            'custom_delivery_revision_requested_at' => now(),
            'custom_delivery_accepted_at' => null,
        ]);

        return response()->json([
            'message' => 'Revision request sent to the merchant.',
            'custom_delivery' => [
                'status' => $order->custom_delivery_status,
                'revision_message' => $order->custom_delivery_revision_message,
                'revision_requested_at' => $order->custom_delivery_revision_requested_at?->toISOString(),
            ],
        ]);
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

        $refundPolicy = $order->refundPolicyContext();
        if (($refundPolicy['status'] ?? null) !== 'eligible') {
            return response()->json([
                'message' => $refundPolicy['reason'] ?? 'This order is not eligible for a refund claim.',
                'refund_policy' => $refundPolicy,
            ], 422);
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
                    'refund_eligibility_status' => $order->refundPolicyContext()['status'] ?? 'eligible',
                    'refund_eligibility_reason' => $order->refundPolicyContext()['reason'] ?? null,
                    'refund_policy_snapshot' => $order->refundPolicyContext(),
                    'status' => 'open',
                ]
            );
        });

        return response()->json(['message' => 'Mgogoro umefunguliwa. Admin atafanya uchunguzi hivi punde.']);
    }
}
