<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Dispute;
use App\Models\ReturnRequest;
use App\Http\Resources\OrderResource;
use App\Services\ForwarderShipmentService;
use App\Services\PickupAgreementService;
use App\Payments\GatewayRegistry;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BuyerSettlementController extends Controller
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

        $isForwarderHandoff = $order->delivery?->delivery_type === 'forwarder'
            && in_array($order->delivery?->delivery_status, ['ready_at_terminal', 'customer_confirmed'], true);
        $allowedPaymentStatuses = $isForwarderHandoff
            ? ['pending_fulfillment', 'payment_confirmed', 'release_eligible']
            : ['pending_fulfillment', 'payment_confirmed', 'release_eligible'];

        if (!in_array($order->payment_status, $allowedPaymentStatuses, true)) {
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
                $isForwarder = $order->delivery->delivery_type === 'forwarder';
                $order->delivery->update([
                    'delivery_status' => $isForwarder ? 'customer_confirmed' : 'delivered',
                    'delivered_at' => now(),
                    'confirmed_at' => $isForwarder ? now() : $order->delivery->confirmed_at,
                ]);
                $order->delivery->events()->create([
                    'order_id' => $order->id,
                    'status' => $isForwarder ? 'customer_confirmed' : 'delivered',
                    'actor_type' => 'buyer',
                    'actor_user_id' => $order->buyer_id,
                    'note' => $isForwarder ? 'Buyer confirmed forwarder handoff evidence.' : 'Buyer confirmed receipt.',
                ]);
            }
            if ($serviceRequest) {
                $serviceRequest->update([
                    'payment_status' => 'released',
                    'delivery_status' => 'customer_confirmed',
                    'customer_confirmed_at' => now(),
                    'status' => 'completed',
                ]);
            }

            app(\App\Services\MarketplaceSettlementService::class)->releaseAfterFulfillment($order, 'buyer_receipt_confirmed', [
                'delivery_id' => $order->delivery?->id,
            ]);
            app(ForwarderShipmentService::class)->syncFromOrderDelivery($order->fresh('delivery'), $order->buyer_id);
        });

        return response()->json(['message' => $serviceRequest ? 'Asante! Umethibitisha huduma.' : 'Asante! Malipo yametumwa kwa muuzaji.']);
    }

    public function requestPickupExtension(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $order->loadMissing(['delivery']);
        if ($order->delivery?->delivery_type !== 'self_pickup') {
            return response()->json(['message' => 'Extension requests apply only to pickup orders.'], 422);
        }

        if ($order->pickup_completed_at || in_array($order->payment_status, ['paid_out', 'refunded'], true)) {
            return response()->json(['message' => 'This pickup order is already closed.'], 422);
        }

        $validated = $request->validate([
            'requested_deadline_at' => 'required|date|after:now',
            'reason' => 'nullable|string|max:1000',
        ]);

        $updated = app(PickupAgreementService::class)->requestExtension(
            $order,
            $request->user()->id,
            Carbon::parse($validated['requested_deadline_at']),
            $validated['reason'] ?? null
        );

        return response()->json([
            'message' => 'Pickup extension request sent.',
            'order' => $updated->fresh(['delivery']),
        ]);
    }

    public function acceptExtraCharge(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'payment_number' => 'nullable|string|max:32',
            'proposal_id' => 'nullable|string|max:80',
        ]);

        $paymentPhone = $validated['payment_number']
            ?? $order->payment_phone
            ?? $order->account_phone
            ?? $request->user()->phone_number;

        $paymentOrder = app(PickupAgreementService::class)->createExtraChargePaymentOrder(
            $order,
            $request->user()->id,
            $paymentPhone,
            $validated['proposal_id'] ?? null
        );

        try {
            $gatewayRegistry = app(GatewayRegistry::class);
            [$gateway, $countryCode] = $this->resolveFollowUpPaymentGateway(
                $gatewayRegistry,
                $request,
                $order,
                $paymentPhone
            );

            $paymentOrder->forceFill([
                'payment_gateway' => $gateway->getName(),
                'payment_provider_id' => $order->payment_provider_id,
                'payment_provider_channel_id' => $order->payment_provider_channel_id,
                'payment_channel_snapshot' => $order->payment_channel_snapshot,
                'money_quote_snapshot' => $order->money_quote_snapshot,
                'country_code' => $countryCode,
                'payment_phone' => $paymentPhone,
            ])->save();

            if (! (bool) config('payment_gateways.live_checkout', false)) {
                if (app()->environment('production')) {
                    return response()->json(['message' => 'A licensed PSP payment route is required in production.'], 503);
                }
                app(\App\Payments\PaymentCallbackProcessor::class)->handleSuccess(
                    $paymentOrder->fresh(['merchant', 'product']),
                    'SIM-EXTRA-' . $paymentOrder->id,
                    $gateway->getName()
                );

                return response()->json([
                    'message' => 'Extra charge simulation completed successfully.',
                    'order' => OrderResource::make($order->fresh(['delivery', 'product', 'buyer']))->resolve(),
                    'payment_order' => [
                        'id' => $paymentOrder->id,
                        'public_id' => $paymentOrder->public_id,
                        'payment_status' => $paymentOrder->fresh()->payment_status,
                        'amount' => (float) $paymentOrder->total_paid,
                    ],
                ]);
            }

            $paymentResult = $gateway->initiate($paymentOrder->fresh(['buyer']), [
                'payment_number' => $paymentPhone,
            ]);

            if (!$paymentResult->success) {
                $paymentOrder->forceFill(['payment_status' => 'failed'])->save();

                return response()->json([
                    'message' => $this->paymentStartFailureMessage(
                        'Extra charge payment could not be started.',
                        $paymentResult->message
                    ),
                ], 422);
            }
        } catch (\Throwable $e) {
            $paymentOrder->forceFill(['payment_status' => 'failed'])->save();

            return response()->json([
                'message' => 'Extra charge payment could not be started.',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'message' => 'Extra charge accepted. Payment request sent.',
            'order' => OrderResource::make($order->fresh(['delivery', 'product', 'buyer']))->resolve(),
            'payment_order' => [
                'id' => $paymentOrder->id,
                'public_id' => $paymentOrder->public_id,
                'payment_status' => $paymentOrder->payment_status,
                'amount' => (float) $paymentOrder->total_paid,
            ],
        ]);
    }

    public function requestPickupDeliveryConversion(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'delivery_type' => 'nullable|string|in:local_boda,intercity_bus,forwarder',
            'physical_address' => 'required|string|max:1000',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'note' => 'nullable|string|max:1000',
        ]);

        $updated = app(PickupAgreementService::class)->requestDeliveryConversion(
            $order,
            $request->user()->id,
            $validated
        );

        return response()->json([
            'message' => 'Delivery conversion request sent.',
            'order' => $updated->fresh(['delivery']),
        ]);
    }

    public function acceptPickupDeliveryConversion(Request $request, Order $order): JsonResponse
    {
        if ($order->buyer_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'payment_number' => 'nullable|string|max:32',
        ]);

        $paymentPhone = $validated['payment_number']
            ?? $order->payment_phone
            ?? $order->account_phone
            ?? $request->user()->phone_number;

        $paymentOrder = app(PickupAgreementService::class)->createDeliveryConversionPaymentOrder(
            $order,
            $request->user()->id,
            $paymentPhone
        );

        try {
            $gatewayRegistry = app(GatewayRegistry::class);
            [$gateway, $countryCode] = $this->resolveFollowUpPaymentGateway(
                $gatewayRegistry,
                $request,
                $order,
                $paymentPhone
            );

            $paymentOrder->forceFill([
                'payment_gateway' => $gateway->getName(),
                'payment_provider_id' => $order->payment_provider_id,
                'payment_provider_channel_id' => $order->payment_provider_channel_id,
                'payment_channel_snapshot' => $order->payment_channel_snapshot,
                'money_quote_snapshot' => $order->money_quote_snapshot,
                'country_code' => $countryCode,
                'payment_phone' => $paymentPhone,
            ])->save();

            if (! (bool) config('payment_gateways.live_checkout', false)) {
                if (app()->environment('production')) {
                    return response()->json(['message' => 'A licensed PSP payment route is required in production.'], 503);
                }
                app(\App\Payments\PaymentCallbackProcessor::class)->handleSuccess(
                    $paymentOrder->fresh(['merchant', 'product']),
                    'SIM-DELIVERY-' . $paymentOrder->id,
                    $gateway->getName()
                );

                return response()->json([
                    'message' => 'Delivery fee simulation completed successfully.',
                    'order' => OrderResource::make($order->fresh(['delivery', 'product', 'buyer']))->resolve(),
                    'payment_order' => [
                        'id' => $paymentOrder->id,
                        'public_id' => $paymentOrder->public_id,
                        'payment_status' => $paymentOrder->fresh()->payment_status,
                        'amount' => (float) $paymentOrder->total_paid,
                    ],
                ]);
            }

            $paymentResult = $gateway->initiate($paymentOrder->fresh(['buyer']), [
                'payment_number' => $paymentPhone,
            ]);

            if (!$paymentResult->success) {
                $paymentOrder->forceFill(['payment_status' => 'failed'])->save();

                return response()->json([
                    'message' => $this->paymentStartFailureMessage(
                        'Delivery fee payment could not be started.',
                        $paymentResult->message
                    ),
                ], 422);
            }
        } catch (\Throwable $e) {
            $paymentOrder->forceFill(['payment_status' => 'failed'])->save();

            return response()->json([
                'message' => 'Delivery fee payment could not be started.',
                'error' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'message' => 'Delivery fee payment request sent.',
            'order' => OrderResource::make($order->fresh(['delivery', 'product', 'buyer']))->resolve(),
            'payment_order' => [
                'id' => $paymentOrder->id,
                'public_id' => $paymentOrder->public_id,
                'payment_status' => $paymentOrder->payment_status,
                'amount' => (float) $paymentOrder->total_paid,
            ],
        ]);
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

        if (! in_array($order->payment_status, ['payment_confirmed', 'pending_fulfillment'], true)) {
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

        if (!in_array($order->payment_status, ['pending_fulfillment', 'payment_confirmed', 'release_eligible'])) {
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
            if (in_array($order->payment_status, ['pending_fulfillment', 'payment_confirmed', 'release_eligible'], true)) {
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

    private function resolveFollowUpPaymentGateway(GatewayRegistry $gatewayRegistry, Request $request, Order $parentOrder, ?string $paymentPhone): array
    {
        if ($parentOrder->payment_gateway) {
            try {
                $gateway = $gatewayRegistry->resolveByName($parentOrder->payment_gateway);
                $supportedCountries = $gateway->getSupportedCountries();
                $countryCode = $parentOrder->country_code ?: ($supportedCountries[0] ?? null);

                if ($countryCode) {
                    return [$gateway, strtoupper($countryCode)];
                }
            } catch (\Throwable) {
                // Fall back to current routing if the stored gateway is no longer available.
            }
        }

        $gateway = $gatewayRegistry->resolve($request, $paymentPhone);

        return [$gateway, $gatewayRegistry->resolveCountry($request, $paymentPhone)];
    }

    private function paymentStartFailureMessage(string $fallback, ?string $providerMessage): string
    {
        $message = trim((string) $providerMessage);
        $lower = strtolower($message);

        if ($message !== '' && !str_contains($lower, 'authorization key') && !str_contains($lower, 'credential')) {
            return $message;
        }

        return $fallback . ' Please try again or contact support.';
    }
}
