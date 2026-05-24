<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Dispute;
use App\Models\ReturnRequest;
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

        $revisionLimit = Order::CUSTOM_DELIVERY_REVISION_LIMIT;
        if ((int) $order->custom_delivery_revision_count >= $revisionLimit) {
            return response()->json([
                'message' => "You have used all {$revisionLimit} revision requests for this custom work. Please accept the work or open a dispute if there is a serious issue.",
                'revision_limit' => $revisionLimit,
                'revision_count' => (int) $order->custom_delivery_revision_count,
            ], 422);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'min:10', 'max:3000'],
        ]);

        $nextRevisionCount = ((int) $order->custom_delivery_revision_count) + 1;

        $order->update([
            'custom_delivery_status' => 'revision_requested',
            'custom_delivery_revision_message' => $validated['message'],
            'custom_delivery_revision_requested_at' => now(),
            'custom_delivery_revision_count' => $nextRevisionCount,
            'custom_delivery_accepted_at' => null,
        ]);

        $order->customDeliveryEvents()->create([
            'actor_type' => 'buyer',
            'actor_id' => $request->user()->id,
            'event_type' => 'revision_requested',
            'revision_number' => $nextRevisionCount,
            'message' => $validated['message'],
        ]);

        return response()->json([
            'message' => 'Revision request sent to the merchant.',
            'custom_delivery' => [
                'status' => $order->custom_delivery_status,
                'revision_message' => $order->custom_delivery_revision_message,
                'revision_requested_at' => $order->custom_delivery_revision_requested_at?->toISOString(),
                'revision_count' => (int) $order->custom_delivery_revision_count,
                'revision_limit' => Order::CUSTOM_DELIVERY_REVISION_LIMIT,
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

        DB::transaction(function () use ($order, $evidenceUrl, $validated, $serviceRequest, $request) {
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

            if ($order->product?->isDigital() && ($order->product?->digital_delivery_type ?? null) === 'custom_delivery') {
                $order->customDeliveryEvents()->create([
                    'actor_type' => 'buyer',
                    'actor_id' => $request->user()->id,
                    'event_type' => 'dispute_opened',
                    'revision_number' => (int) $order->custom_delivery_revision_count,
                    'file_url' => $evidenceUrl !== 'service-dispute-no-file' ? $evidenceUrl : null,
                    'message' => $validated['reason'],
                ]);
            }
        });

        return response()->json(['message' => 'Mgogoro umefunguliwa. Admin atafanya uchunguzi hivi punde.']);
    }

    /**
     * POST /api/buyer/orders/{order}/return-request
     */
    public function requestReturn(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $order->loadMissing(['product', 'returnRequest']);

        if ($order->product?->type !== 'physical') {
            return response()->json(['message' => 'Return requests are only available for physical products.'], 422);
        }

        if ($order->returnRequest) {
            return response()->json([
                'message' => 'Return request already exists for this order.',
                'return_request' => $this->returnRequestPayload($order->returnRequest),
            ], 422);
        }

        $policy = $order->refundPolicyContext();
        if (($policy['status'] ?? null) !== 'eligible') {
            return response()->json([
                'message' => $policy['reason'] ?? 'This order is not eligible for a return request.',
                'refund_policy' => $policy,
            ], 422);
        }

        $validated = $request->validate([
            'evidence' => 'nullable|file|mimetypes:video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,application/pdf|max:51200',
            'reason' => 'required|string|min:10|max:2000',
            'resolution_type' => 'nullable|string|in:return_or_replace,refund,replacement',
        ]);

        $evidenceUrl = null;
        if ($request->hasFile('evidence')) {
            $path = $request->file('evidence')->store('return-requests', 'public');
            $evidenceUrl = Storage::disk('public')->url($path);
        }

        $returnRequest = ReturnRequest::create([
            'order_id' => $order->id,
            'buyer_id' => $request->user()->id,
            'merchant_id' => $order->merchant_id,
            'product_id' => $order->product_id,
            'status' => ReturnRequest::STATUS_PENDING,
            'resolution_type' => $validated['resolution_type'] ?? 'return_or_replace',
            'reason' => $validated['reason'],
            'evidence_url' => $evidenceUrl,
            'policy_snapshot' => $policy,
            'requested_at' => now(),
        ]);

        return response()->json([
            'message' => 'Return request sent to the merchant.',
            'return_request' => $this->returnRequestPayload($returnRequest),
        ]);
    }

    /**
     * POST /api/buyer/return-requests/{returnRequest}/escalate
     */
    public function escalateReturn(Request $request, ReturnRequest $returnRequest): JsonResponse
    {
        if ((int) $returnRequest->buyer_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($returnRequest->status === ReturnRequest::STATUS_ESCALATED) {
            return response()->json(['message' => 'Return request is already escalated.'], 422);
        }

        $validated = $request->validate([
            'reason' => 'nullable|string|max:2000',
        ]);

        $order = $returnRequest->order()->with('product')->first();
        if (! $order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $dispute = DB::transaction(function () use ($returnRequest, $order, $validated) {
            if (in_array($order->payment_status, ['escrow_locked', 'shipped'], true)) {
                $order->update(['payment_status' => 'disputed']);
            }

            $dispute = Dispute::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'buyer_unboxing_video_url' => $returnRequest->evidence_url ?: 'return-request-escalation',
                    'dispute_reason' => trim(($validated['reason'] ?? '') ?: $returnRequest->reason),
                    'refund_eligibility_status' => $returnRequest->policy_snapshot['status'] ?? null,
                    'refund_eligibility_reason' => $returnRequest->policy_snapshot['reason'] ?? null,
                    'refund_policy_snapshot' => $returnRequest->policy_snapshot,
                    'status' => 'open',
                ]
            );

            $returnRequest->update([
                'status' => ReturnRequest::STATUS_ESCALATED,
                'dispute_id' => $dispute->id,
                'customer_note' => $validated['reason'] ?? $returnRequest->customer_note,
                'escalated_at' => now(),
            ]);

            return $dispute;
        });

        return response()->json([
            'message' => 'Return request escalated to Takeer.',
            'dispute_id' => $dispute->id,
            'return_request' => $this->returnRequestPayload($returnRequest->fresh()),
        ]);
    }

    private function returnRequestPayload(ReturnRequest $returnRequest): array
    {
        return [
            'id' => $returnRequest->id,
            'status' => $returnRequest->status,
            'resolution_type' => $returnRequest->resolution_type,
            'reason' => $returnRequest->reason,
            'evidence_url' => $returnRequest->evidence_url,
            'policy_snapshot' => $returnRequest->policy_snapshot,
            'merchant_note' => $returnRequest->merchant_note,
            'customer_note' => $returnRequest->customer_note,
            'requested_at' => $returnRequest->requested_at?->toISOString(),
            'approved_at' => $returnRequest->approved_at?->toISOString(),
            'rejected_at' => $returnRequest->rejected_at?->toISOString(),
            'received_at' => $returnRequest->received_at?->toISOString(),
            'completed_at' => $returnRequest->completed_at?->toISOString(),
            'escalated_at' => $returnRequest->escalated_at?->toISOString(),
            'dispute_id' => $returnRequest->dispute_id,
        ];
    }
}
