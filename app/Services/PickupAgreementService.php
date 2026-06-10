<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Models\MerchantLocation;
use App\Models\Message;
use App\Models\Order;
use App\Models\RefundRequest;
use App\Models\Transaction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PickupAgreementService
{
    public function ensureAgreementForPaidPickup(Order $order, ?Carbon $readyAt = null): ?Order
    {
        $order->loadMissing(['delivery', 'merchant.locations', 'product', 'buyer']);

        if ($order->delivery?->delivery_type !== 'self_pickup') {
            return null;
        }

        if (!in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked'], true)) {
            return null;
        }

        if ($order->pickup_policy_snapshot && $order->pickup_deadline_at) {
            return $order;
        }

        $location = $this->resolvePickupLocation($order);
        $existingSnapshot = $order->pickup_policy_snapshot ?: [];
        $buyerSlot = $existingSnapshot['buyer_requested_slot'] ?? null;
        $snapshot = array_merge($existingSnapshot, $this->buildPolicySnapshot($order, $location));
        $readyAt ??= now();

        if ($buyerSlot && !empty($buyerSlot['start_at']) && !empty($buyerSlot['end_at'])) {
            $readyAt = Carbon::parse($buyerSlot['start_at']);
            $deadlineAt = Carbon::parse($buyerSlot['end_at']);
            $snapshot['buyer_requested_slot'] = [
                ...$buyerSlot,
                'status' => 'accepted',
                'accepted_at' => now()->toISOString(),
            ];
        } else {
            $deadlineAt = $this->addPickupOpenHours($readyAt->copy(), (int) $snapshot['hold_hours'], $snapshot['available_windows'] ?? null);
        }

        $order->forceFill([
            'pickup_location_id' => $location?->id,
            'pickup_ready_at' => $readyAt,
            'pickup_deadline_at' => $deadlineAt,
            'pickup_grace_ends_at' => null,
            'pickup_status' => 'ready_for_pickup',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $order->delivery?->update(['delivery_status' => 'ready_for_pickup']);
        $this->writePickupTermsMessage($order->fresh(['buyer', 'merchant.user', 'delivery']), $snapshot);

        return $order->fresh(['delivery']);
    }

    public function markNoShow(Order $order, int $actorUserId, ?string $reason = null): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer']);

        $order->forceFill([
            'pickup_status' => 'buyer_no_show',
            'pickup_no_show_marked_at' => now(),
            'pickup_no_show_reason' => $reason,
        ])->save();

        $order->delivery?->events()->create([
            'order_id' => $order->id,
            'status' => 'buyer_no_show',
            'actor_type' => 'merchant',
            'actor_user_id' => $actorUserId,
            'note' => $reason ?: 'Buyer did not collect within the agreed pickup window.',
            'metadata' => [
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
                'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
            ],
        ]);

        $message = $order->messages()->create([
            'sender_id' => $actorUserId,
            'receiver_id' => $order->buyer_id,
            'type' => 'system',
            'body' => $reason
                ? "Merchant marked this pickup as no-show: {$reason}"
                : 'Merchant marked this pickup as no-show because the pickup window has passed.',
            'payload' => [
                'action_type' => 'buyer_no_show_marked',
                'acting_as' => 'merchant',
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
                'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
                'reason' => $reason,
            ],
        ]);
        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();

        return $order->fresh(['delivery']);
    }

    public function markOverdue(Order $order): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer']);

        if ($order->delivery?->delivery_type !== 'self_pickup') {
            return $order;
        }

        if (!$order->pickup_deadline_at || $order->pickup_deadline_at->isFuture()) {
            return $order;
        }

        if (in_array($order->pickup_status, [
            'pickup_overdue',
            'buyer_no_show',
            'completed',
            'converted_to_delivery',
            'holding_fee_pending',
            'holding_fee_payment_pending',
            'holding_fee_paid_held',
            'cancelled_after_grace',
        ], true)) {
            return $order;
        }

        $order->forceFill([
            'pickup_status' => 'pickup_overdue',
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $order->merchant?->user_id ?: $order->buyer_id,
            'receiver_id' => $order->buyer_id,
            'body' => 'Pickup window expired. Please agree next steps in this order chat.',
            'action_type' => 'pickup_window_expired',
            'acting_as' => 'system',
            'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
            'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
            'late_fee_estimate' => $this->calculateLatePickupFee($order),
        ]);

        return $order->fresh(['delivery']);
    }

    public function cancelAfterGrace(Order $order, ?int $actorUserId = null, string $actor = 'system', ?string $reason = null): Order
    {
        return DB::transaction(function () use ($order, $actorUserId, $actor, $reason) {
            $order = Order::query()
                ->with(['delivery', 'merchant.user', 'buyer', 'product'])
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($order->delivery?->delivery_type !== 'self_pickup') {
                abort(422, 'Pickup cancellation applies only to pickup orders.');
            }

            if ($order->pickup_completed_at || in_array($order->payment_status, ['resolved_merchant_paid', 'resolved_buyer_refunded', 'refund_pending'], true)) {
                return $order;
            }

            if (!$order->pickup_deadline_at || $order->pickup_deadline_at->isFuture()) {
                abort(422, 'Pickup deadline has not passed yet.');
            }

            $snapshot = $order->pickup_policy_snapshot ?: [];
            $percent = max(0, min(100, (float) ($snapshot['cancellation_penalty_percent'] ?? 0)));
            $paidAmount = max(0, (float) $order->total_paid);
            $penaltyAmount = round($paidAmount * ($percent / 100), 2);
            $refundAmount = max(0, round($paidAmount - $penaltyAmount, 2));

            $order->releaseInventory();

            if ($penaltyAmount > 0 && $order->merchant?->user) {
                $this->creditMerchantPenalty($order, $penaltyAmount);
            }

            $order->forceFill([
                'pickup_status' => 'cancelled_after_grace',
                'pickup_no_show_marked_at' => $order->pickup_no_show_marked_at ?: now(),
                'pickup_no_show_reason' => $reason ?: 'Pickup deadline passed without collection.',
                'pickup_cancellation_penalty_percent' => $percent,
                'pickup_cancellation_penalty_amount' => $penaltyAmount,
                'pickup_cancellation_refund_amount' => $refundAmount,
                'pickup_cancelled_after_grace_at' => now(),
                'payment_status' => 'refund_pending',
                'cancelled_at' => now(),
                'cancelled_by' => $actor,
                'cancellation_reason' => $reason ?: 'Cancelled after pickup deadline passed.',
            ])->save();

            $refundRequest = $this->createPickupRefundRequest($order->fresh(['buyer', 'merchant']), $refundAmount, $penaltyAmount, $percent, $reason);

            $holdingFeeOrders = Order::query()
                ->where('merchant_id', $order->merchant_id)
                ->where('payment_status', 'escrow_locked')
                ->whereNull('paid_out_at')
                ->where('extra_items->type', 'pickup_holding_fee')
                ->where('extra_items->parent_order_id', $order->id)
                ->lockForUpdate()
                ->get();

            foreach ($holdingFeeOrders as $feeOrder) {
                $this->creditMerchantPenalty($feeOrder, (float) $feeOrder->total_paid, 'PICKUP-LATE-FEE');
                $feeOrder->forceFill([
                    'payment_status' => 'resolved_merchant_paid',
                    'paid_out_at' => now(),
                ])->save();
            }

            $this->writeActionMessage($order, [
                'sender_id' => $actorUserId ?: ($order->merchant?->user_id ?: $order->buyer_id),
                'receiver_id' => $order->buyer_id,
                'body' => 'Pickup order cancelled after the pickup deadline passed.',
                'action_type' => 'pickup_cancelled_after_grace',
                'acting_as' => $actor,
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
                'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
                'penalty_percent' => $percent,
                'penalty_amount' => $penaltyAmount,
                'refund_amount' => $refundAmount,
                'refund_request_id' => $refundRequest?->id,
                'refund_status' => $refundRequest?->status,
                'currency' => $order->merchant_currency_code ?: 'TZS',
                'reason' => $reason,
            ]);

            return $order->fresh(['delivery']);
        });
    }

    public function requestExtension(Order $order, int $buyerUserId, Carbon $requestedDeadlineAt, ?string $reason = null): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer']);

        $snapshot = $order->pickup_policy_snapshot ?: [];
        if (($snapshot['extension_allowed'] ?? true) === false) {
            abort(422, 'Pickup extensions are not allowed for this order.');
        }

        $snapshot['pending_extension'] = [
            'requested_by' => 'buyer',
            'requested_at' => now()->toISOString(),
            'requested_deadline_at' => $requestedDeadlineAt->toISOString(),
            'reason' => $reason,
            'status' => 'pending',
        ];

        $order->forceFill([
            'pickup_status' => 'extension_requested',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $buyerUserId,
            'receiver_id' => $order->merchant?->user_id,
            'body' => 'Buyer requested a pickup extension.',
            'action_type' => 'pickup_extension_requested',
            'acting_as' => 'buyer',
            'requested_deadline_at' => $requestedDeadlineAt->toISOString(),
            'reason' => $reason,
        ]);

        return $order->fresh(['delivery']);
    }

    public function resolveExtension(Order $order, int $merchantUserId, string $decision, ?Carbon $approvedDeadlineAt = null, ?string $note = null): Order
    {
        $order->loadMissing(['delivery', 'buyer', 'merchant.user']);
        $snapshot = $order->pickup_policy_snapshot ?: [];
        $pending = $snapshot['pending_extension'] ?? null;

        if (!$pending || ($pending['status'] ?? null) !== 'pending') {
            abort(422, 'No pending pickup extension request found.');
        }

        if ($decision === 'approved') {
            $deadline = $approvedDeadlineAt ?: Carbon::parse($pending['requested_deadline_at']);
            $snapshot['pending_extension']['status'] = 'approved';
            $snapshot['pending_extension']['resolved_at'] = now()->toISOString();
            $snapshot['pending_extension']['resolved_by'] = 'merchant';
            $snapshot['pending_extension']['approved_deadline_at'] = $deadline->toISOString();
            $snapshot['pending_extension']['note'] = $note;

            $order->forceFill([
                'pickup_deadline_at' => $deadline,
                'pickup_grace_ends_at' => null,
                'pickup_status' => 'ready_for_pickup',
                'pickup_extension_count' => ((int) $order->pickup_extension_count) + 1,
                'pickup_policy_snapshot' => $snapshot,
            ])->save();

            $this->writeActionMessage($order, [
                'sender_id' => $merchantUserId,
                'receiver_id' => $order->buyer_id,
                'body' => 'Merchant approved the pickup extension.',
                'action_type' => 'pickup_extension_approved',
                'acting_as' => 'merchant',
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
                'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
                'note' => $note,
            ]);

            return $order->fresh(['delivery']);
        }

        $snapshot['pending_extension']['status'] = 'rejected';
        $snapshot['pending_extension']['resolved_at'] = now()->toISOString();
        $snapshot['pending_extension']['resolved_by'] = 'merchant';
        $snapshot['pending_extension']['note'] = $note;

        $order->forceFill([
            'pickup_status' => 'ready_for_pickup',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $merchantUserId,
            'receiver_id' => $order->buyer_id,
            'body' => 'Merchant rejected the pickup extension request.',
            'action_type' => 'pickup_extension_rejected',
            'acting_as' => 'merchant',
            'note' => $note,
        ]);

        return $order->fresh(['delivery']);
    }

    public function proposeHoldingFee(Order $order, int $merchantUserId, ?float $amount = null, ?string $note = null): Order
    {
        $order->loadMissing(['delivery', 'buyer', 'merchant.user']);
        $snapshot = $order->pickup_policy_snapshot ?: [];

        if (!$order->pickup_deadline_at || $order->pickup_deadline_at->isFuture()) {
            abort(422, 'Pickup deadline has not expired yet.');
        }

        $amount = $amount !== null ? (float) $amount : $this->calculateLatePickupFee($order);

        if ($amount <= 0) {
            abort(422, 'Extra cost amount must be greater than zero.');
        }

        $order->forceFill([
            'pickup_status' => 'holding_fee_pending',
            'holding_fee_status' => 'proposed',
            'holding_fee_amount' => $amount,
            'holding_fee_started_at' => now(),
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $merchantUserId,
            'receiver_id' => $order->buyer_id,
            'body' => 'Merchant proposed an extra agreed cost for this overdue pickup.',
            'action_type' => 'holding_fee_proposed',
            'acting_as' => 'merchant',
            'amount' => $amount,
            'currency' => $order->merchant_currency_code ?: 'TZS',
            'note' => $note,
            'fee_type' => $snapshot['late_fee_type'] ?? 'fixed',
            'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
            'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
        ]);

        return $order->fresh(['delivery']);
    }

    public function createHoldingFeePaymentOrder(Order $order, int $buyerUserId, ?string $paymentPhone = null): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer', 'product']);

        if (!in_array($order->holding_fee_status, ['proposed', 'payment_pending'], true) || $order->holding_fee_amount === null) {
            abort(422, 'No extra cost proposal is waiting for acceptance.');
        }

        if ($order->buyer_id !== $buyerUserId) {
            abort(403, 'Unauthorized.');
        }

        if ($order->holding_fee_payment_order_id) {
            $existing = Order::query()->find($order->holding_fee_payment_order_id);
            if ($existing && $existing->payment_status === 'pending') {
                return $existing;
            }
        }

        $amount = (float) $order->holding_fee_amount;
        if ($amount <= 0) {
            abort(422, 'Extra cost amount must be greater than zero.');
        }

        $paymentOrder = Order::query()->create([
            'buyer_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'product_id' => $order->product_id,
            'variant_id' => $order->variant_id,
            'purchasable_type' => 'holding_fee',
            'purchasable_id' => $order->id,
            'order_kind' => 'one_time',
            'quantity' => 1,
            'unit_price' => $amount,
            'total_paid' => $amount,
            'merchant_currency_code' => $order->merchant_currency_code,
            'customer_currency_code' => $order->customer_currency_code,
            'merchant_total_amount' => $amount,
            'customer_total_amount' => $amount,
            'payment_status' => 'pending',
            'payment_phone' => $paymentPhone ?: $order->payment_phone ?: $order->account_phone,
            'account_phone' => $order->account_phone,
            'country_code' => $order->country_code,
            'source' => 'online',
            'payment_mode' => 'online_escrow',
            'transaction_ref' => 'HOLD-' . $order->id . '-' . strtoupper(Str::random(10)),
            'extra_items' => [
                'type' => 'pickup_holding_fee',
                'parent_order_id' => $order->id,
                'parent_public_id' => $order->public_id,
            ],
        ]);

        $order->forceFill([
            'holding_fee_status' => 'payment_pending',
            'holding_fee_accepted_at' => now(),
            'holding_fee_payment_order_id' => $paymentOrder->id,
            'pickup_status' => 'holding_fee_payment_pending',
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $buyerUserId,
            'receiver_id' => $order->merchant?->user_id,
            'body' => 'Buyer accepted the extra cost proposal and started payment.',
            'action_type' => 'holding_fee_payment_started',
            'acting_as' => 'buyer',
            'amount' => $amount,
            'currency' => $order->merchant_currency_code ?: 'TZS',
            'payment_order_id' => $paymentOrder->id,
        ]);

        return $paymentOrder;
    }

    public function markHoldingFeePaid(Order $paymentOrder, string $gatewayRef, string $gateway): Order
    {
        $parentOrderId = (int) data_get($paymentOrder->extra_items, 'parent_order_id');
        if (!$parentOrderId || data_get($paymentOrder->extra_items, 'type') !== 'pickup_holding_fee') {
            abort(422, 'This is not a holding fee payment order.');
        }

        $parent = Order::query()->with(['delivery', 'merchant.user', 'buyer'])->lockForUpdate()->findOrFail($parentOrderId);
        $amount = (float) $paymentOrder->total_paid;

        $paymentOrder->forceFill([
            'payment_status' => 'escrow_locked',
            'gateway_ref' => $gatewayRef,
            'payment_gateway' => $gateway,
        ])->save();

        $parent->forceFill([
            'holding_fee_status' => 'paid_held',
            'holding_fee_paid_at' => now(),
            'holding_fee_payment_order_id' => $paymentOrder->id,
            'pickup_status' => 'holding_fee_paid_held',
        ])->save();

        $this->writeActionMessage($parent, [
            'sender_id' => $parent->buyer_id,
            'receiver_id' => $parent->merchant?->user_id,
            'body' => 'Late pickup fee payment is held in escrow.',
            'action_type' => 'holding_fee_paid_held',
            'acting_as' => 'buyer',
            'amount' => $amount,
            'currency' => $parent->merchant_currency_code ?: 'TZS',
            'payment_order_id' => $paymentOrder->id,
        ]);

        return $parent->fresh(['delivery']);
    }

    public function requestDeliveryConversion(Order $order, int $buyerUserId, array $payload): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer']);

        if ($order->buyer_id !== $buyerUserId) {
            abort(403, 'Unauthorized.');
        }

        if ($order->delivery?->delivery_type !== 'self_pickup') {
            abort(422, 'Delivery conversion applies only to pickup orders.');
        }

        $snapshot = $order->pickup_policy_snapshot ?: [];
        $snapshot['delivery_conversion'] = [
            'status' => 'requested',
            'requested_by' => 'buyer',
            'requested_at' => now()->toISOString(),
            'delivery_type' => $payload['delivery_type'] ?? 'local_boda',
            'physical_address' => $payload['physical_address'] ?? null,
            'latitude' => $payload['latitude'] ?? null,
            'longitude' => $payload['longitude'] ?? null,
            'note' => $payload['note'] ?? null,
        ];

        $order->forceFill([
            'pickup_status' => 'delivery_conversion_requested',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $buyerUserId,
            'receiver_id' => $order->merchant?->user_id,
            'body' => 'Buyer requested delivery conversion for this pickup order.',
            'action_type' => 'delivery_conversion_requested',
            'acting_as' => 'buyer',
            ...$snapshot['delivery_conversion'],
        ]);

        return $order->fresh(['delivery']);
    }

    public function quoteDeliveryConversion(Order $order, int $merchantUserId, float $shippingFee, ?string $note = null): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer']);
        $snapshot = $order->pickup_policy_snapshot ?: [];
        $conversion = $snapshot['delivery_conversion'] ?? null;

        if (!$conversion || ($conversion['status'] ?? null) !== 'requested') {
            abort(422, 'No delivery conversion request is waiting for a quote.');
        }

        $snapshot['delivery_conversion'] = [
            ...$conversion,
            'status' => 'quoted',
            'quoted_at' => now()->toISOString(),
            'quoted_by' => 'merchant',
            'shipping_fee' => $shippingFee,
            'note' => $note,
        ];

        $order->forceFill([
            'pickup_status' => 'delivery_conversion_quoted',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $merchantUserId,
            'receiver_id' => $order->buyer_id,
            'body' => 'Merchant quoted delivery conversion fee.',
            'action_type' => 'delivery_conversion_quoted',
            'acting_as' => 'merchant',
            'shipping_fee' => $shippingFee,
            'note' => $note,
        ]);

        return $order->fresh(['delivery']);
    }

    public function createDeliveryConversionPaymentOrder(Order $order, int $buyerUserId, ?string $paymentPhone = null): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer', 'product']);
        $snapshot = $order->pickup_policy_snapshot ?: [];
        $conversion = $snapshot['delivery_conversion'] ?? null;

        if ($order->buyer_id !== $buyerUserId) {
            abort(403, 'Unauthorized.');
        }

        if (!$conversion || ($conversion['status'] ?? null) !== 'quoted') {
            abort(422, 'No delivery conversion quote is waiting for payment.');
        }

        $amount = (float) ($conversion['shipping_fee'] ?? 0);
        if ($amount <= 0) {
            abort(422, 'Delivery conversion fee must be greater than zero.');
        }

        $existingId = (int) ($conversion['payment_order_id'] ?? 0);
        if ($existingId) {
            $existing = Order::query()->find($existingId);
            if ($existing && $existing->payment_status === 'pending') {
                return $existing;
            }
        }

        $paymentOrder = Order::query()->create([
            'buyer_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'product_id' => $order->product_id,
            'variant_id' => $order->variant_id,
            'purchasable_type' => 'pickup_delivery_fee',
            'purchasable_id' => $order->id,
            'order_kind' => 'one_time',
            'quantity' => 1,
            'unit_price' => $amount,
            'total_paid' => $amount,
            'merchant_currency_code' => $order->merchant_currency_code,
            'customer_currency_code' => $order->customer_currency_code,
            'merchant_total_amount' => $amount,
            'customer_total_amount' => $amount,
            'payment_status' => 'pending',
            'payment_phone' => $paymentPhone ?: $order->payment_phone ?: $order->account_phone,
            'account_phone' => $order->account_phone,
            'country_code' => $order->country_code,
            'source' => 'online',
            'payment_mode' => 'online_escrow',
            'transaction_ref' => 'DELV-' . $order->id . '-' . strtoupper(Str::random(10)),
            'extra_items' => [
                'type' => 'pickup_delivery_fee',
                'parent_order_id' => $order->id,
                'parent_public_id' => $order->public_id,
            ],
        ]);

        $snapshot['delivery_conversion']['status'] = 'payment_pending';
        $snapshot['delivery_conversion']['payment_order_id'] = $paymentOrder->id;
        $snapshot['delivery_conversion']['accepted_at'] = now()->toISOString();

        $order->forceFill([
            'pickup_status' => 'delivery_conversion_payment_pending',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $buyerUserId,
            'receiver_id' => $order->merchant?->user_id,
            'body' => 'Buyer accepted delivery conversion and started payment.',
            'action_type' => 'delivery_conversion_payment_started',
            'acting_as' => 'buyer',
            'shipping_fee' => $amount,
            'payment_order_id' => $paymentOrder->id,
        ]);

        return $paymentOrder;
    }

    public function markDeliveryConversionPaid(Order $paymentOrder, string $gatewayRef, string $gateway): Order
    {
        $parentOrderId = (int) data_get($paymentOrder->extra_items, 'parent_order_id');
        if (!$parentOrderId || data_get($paymentOrder->extra_items, 'type') !== 'pickup_delivery_fee') {
            abort(422, 'This is not a pickup delivery fee payment order.');
        }

        $parent = Order::query()->with(['delivery', 'merchant.user', 'buyer'])->lockForUpdate()->findOrFail($parentOrderId);
        $snapshot = $parent->pickup_policy_snapshot ?: [];
        $conversion = $snapshot['delivery_conversion'] ?? [];

        $paymentOrder->forceFill([
            'payment_status' => 'escrow_locked',
            'gateway_ref' => $gatewayRef,
            'payment_gateway' => $gateway,
        ])->save();

        $delivery = $parent->delivery()->firstOrCreate(['order_id' => $parent->id]);
        $delivery->forceFill([
            'delivery_type' => $conversion['delivery_type'] ?? 'local_boda',
            'delivery_status' => 'packing',
            'physical_address' => $conversion['physical_address'] ?? $delivery->physical_address,
            'latitude' => $conversion['latitude'] ?? $delivery->latitude,
            'longitude' => $conversion['longitude'] ?? $delivery->longitude,
            'buyer_release_pin' => $delivery->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
        ])->save();

        $snapshot['delivery_conversion']['status'] = 'paid_held';
        $snapshot['delivery_conversion']['paid_at'] = now()->toISOString();

        $parent->forceFill([
            'pickup_status' => 'converted_to_delivery',
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($parent, [
            'sender_id' => $parent->buyer_id,
            'receiver_id' => $parent->merchant?->user_id,
            'body' => 'Delivery conversion fee is paid and held in escrow.',
            'action_type' => 'delivery_conversion_paid_held',
            'acting_as' => 'buyer',
            'shipping_fee' => (float) $paymentOrder->total_paid,
            'payment_order_id' => $paymentOrder->id,
        ]);

        return $parent->fresh(['delivery']);
    }

    public function markCompleted(Order $order): void
    {
        if ($order->delivery?->delivery_type !== 'self_pickup') {
            return;
        }

        $order->forceFill([
            'pickup_status' => 'completed',
            'pickup_completed_at' => now(),
        ])->save();
    }

    private function resolvePickupLocation(Order $order): ?MerchantLocation
    {
        if ($order->pickup_location_id) {
            return MerchantLocation::query()->find($order->pickup_location_id);
        }

        return $order->merchant?->locations
            ? $order->merchant->locations
                ->where('allow_self_pickup', true)
                ->sortByDesc('is_primary')
                ->first()
            : null;
    }

    private function buildPolicySnapshot(Order $order, ?MerchantLocation $location): array
    {
        $productHoldHours = $order->product?->pickup_hold_hours_override;
        $holdHours = max(1, (int) ($productHoldHours ?: $location?->pickup_hold_hours ?: 2));
        $graceHours = max(0, (int) ($location?->pickup_grace_hours ?? 0));
        $holdingFeeEnabled = (bool) ($location?->pickup_holding_fee_enabled ?? false)
            && (bool) ($order->product?->pickup_holding_fee_allowed ?? true);
        $lateFeeType = in_array($location?->pickup_late_fee_type, ['fixed', 'hourly'], true)
            ? $location->pickup_late_fee_type
            : (($location?->pickup_holding_fee_interval ?: 'day') === 'hour' ? 'hourly' : 'fixed');

        return [
            'version' => 2,
            'location_id' => $location?->id,
            'location_name' => $location?->name,
            'location_address' => $location?->address,
            'hold_hours' => $holdHours,
            'grace_hours' => $graceHours,
            'available_windows' => $location?->pickup_available_windows ?: null,
            'instructions' => $location?->pickup_instructions,
            'extension_allowed' => (bool) ($order->product?->pickup_extension_allowed ?? true),
            'holding_fee_enabled' => $holdingFeeEnabled,
            'late_fee_enabled' => $holdingFeeEnabled,
            'late_fee_type' => $lateFeeType,
            'holding_fee_amount' => $holdingFeeEnabled ? (float) ($location?->pickup_holding_fee_amount ?? 0) : null,
            'late_fee_amount' => $holdingFeeEnabled ? (float) ($location?->pickup_holding_fee_amount ?? 0) : null,
            'late_fee_cap_amount' => $holdingFeeEnabled && $location?->pickup_late_fee_cap_amount !== null ? (float) $location->pickup_late_fee_cap_amount : null,
            'holding_fee_interval' => $holdingFeeEnabled ? ($location?->pickup_holding_fee_interval ?: 'day') : null,
            'cancellation_penalty_percent' => (float) ($location?->pickup_cancellation_penalty_percent ?? 0),
            'max_holding_days' => $location?->pickup_max_holding_days ?? 2,
            'product_note' => $order->product?->pickup_policy_note,
            'accepted_at' => now()->toISOString(),
        ];
    }

    public function calculateLatePickupFee(Order $order, ?Carbon $asOf = null): float
    {
        $snapshot = $order->pickup_policy_snapshot ?: [];
        if (!($snapshot['late_fee_enabled'] ?? $snapshot['holding_fee_enabled'] ?? false)) {
            return 0.0;
        }

        $rate = max(0, (float) ($snapshot['late_fee_amount'] ?? $snapshot['holding_fee_amount'] ?? 0));
        if ($rate <= 0 || !$order->pickup_deadline_at) {
            return 0.0;
        }

        $type = $snapshot['late_fee_type'] ?? (($snapshot['holding_fee_interval'] ?? null) === 'hour' ? 'hourly' : 'fixed');
        $amount = $rate;
        if ($type === 'hourly') {
            $minutesLate = max(1, $order->pickup_deadline_at->diffInMinutes($asOf ?: now(), false));
            $startedHours = max(1, (int) ceil($minutesLate / 60));
            $amount = $rate * $startedHours;
        }

        $cap = $snapshot['late_fee_cap_amount'] ?? null;
        if ($cap !== null && (float) $cap > 0) {
            $amount = min($amount, (float) $cap);
        }

        return round($amount, 2);
    }

    private function creditMerchantPenalty(Order $order, float $amount, string $referencePrefix = 'PICKUP-CANCEL-PENALTY'): void
    {
        $amount = round(max(0, $amount), 2);
        if ($amount <= 0) {
            return;
        }

        $merchant = $order->merchant ?: $order->product?->merchant;
        if (!$merchant?->user) {
            return;
        }

        $wallet = $merchant->wallet()->lockForUpdate()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
        );

        if (Transaction::query()
            ->where('order_id', $order->id)
            ->where('type', 'order_revenue')
            ->where('reference', 'like', $referencePrefix . '-%')
            ->exists()) {
            return;
        }

        Transaction::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'order_id' => $order->id,
            'type' => 'order_revenue',
            'gross_amount' => $amount,
            'fee_amount' => 0,
            'tax_amount' => 0,
            'provider_cost_amount' => 0,
            'takeer_margin_amount' => 0,
            'net_amount' => $amount,
            'reference' => $referencePrefix . '-' . $order->id . '-' . Str::random(6),
        ]);

        $wallet->balance = round((float) $wallet->balance + $amount, 2);
        if ($wallet->frozen_balance >= $amount) {
            $wallet->frozen_balance = round((float) $wallet->frozen_balance - $amount, 2);
        }
        $wallet->save();
    }

    private function createPickupRefundRequest(Order $order, float $refundAmount, float $penaltyAmount, float $penaltyPercent, ?string $reason = null): ?RefundRequest
    {
        if ($refundAmount <= 0) {
            return null;
        }

        $existing = RefundRequest::query()
            ->where('order_id', $order->id)
            ->where('source', 'pickup_grace_cancellation')
            ->first();

        if ($existing) {
            return $existing;
        }

        return RefundRequest::query()->create([
            'order_id' => $order->id,
            'source' => 'pickup_grace_cancellation',
            'buyer_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'status' => 'pending',
            'amount' => $refundAmount,
            'currency_code' => $order->customer_currency_code ?: $order->merchant_currency_code ?: 'TZS',
            'merchant_penalty_amount' => $penaltyAmount,
            'merchant_penalty_percent' => $penaltyPercent,
            'reason' => $reason ?: 'Pickup deadline passed without collection.',
            'snapshot' => [
                'order_public_id' => $order->public_id,
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
                'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
                'pickup_policy_snapshot' => $order->pickup_policy_snapshot,
                'total_paid' => (float) $order->total_paid,
                'penalty_amount' => $penaltyAmount,
                'refund_amount' => $refundAmount,
                'created_from' => 'pickup_grace_cancellation',
            ],
        ]);
    }

    private function addPickupOpenHours(Carbon $start, int $hours, ?array $windows): Carbon
    {
        $hours = max(1, $hours);
        $normalized = $this->normalizePickupWindows($windows);

        if (empty($normalized)) {
            return $start->copy()->addHours($hours);
        }

        $cursor = $start->copy();
        $remainingMinutes = $hours * 60;
        $guard = 0;

        while ($remainingMinutes > 0 && $guard < 370) {
            $dayWindows = $normalized[$cursor->isoWeekday()] ?? [];
            $consumedToday = false;

            foreach ($dayWindows as $window) {
                [$startHour, $startMinute] = array_map('intval', explode(':', $window['start']));
                [$endHour, $endMinute] = array_map('intval', explode(':', $window['end']));
                $windowStart = $cursor->copy()->setTime($startHour, $startMinute);
                $windowEnd = $cursor->copy()->setTime($endHour, $endMinute);

                if ($windowEnd->lessThanOrEqualTo($windowStart)) {
                    continue;
                }

                if ($cursor->lessThan($windowStart)) {
                    $cursor = $windowStart;
                }

                if ($cursor->greaterThanOrEqualTo($windowEnd)) {
                    continue;
                }

                $available = max(0, $cursor->diffInMinutes($windowEnd, false));
                if ($remainingMinutes <= $available) {
                    return $cursor->copy()->addMinutes($remainingMinutes);
                }

                $remainingMinutes -= $available;
                $cursor = $windowEnd;
                $consumedToday = true;
            }

            $cursor = $cursor->copy()->addDay()->startOfDay();
            $guard++;

            if (!$consumedToday && empty($dayWindows)) {
                continue;
            }
        }

        return $start->copy()->addHours($hours);
    }

    private function normalizePickupWindows(?array $windows): array
    {
        if (!$windows) {
            return [];
        }

        $grouped = [];
        foreach ($windows as $window) {
            if (!($window['enabled'] ?? true)) {
                continue;
            }

            $day = (int) ($window['day'] ?? 0);
            $start = (string) ($window['start'] ?? '');
            $end = (string) ($window['end'] ?? '');

            if ($day < 1 || $day > 7 || !preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end) || $start >= $end) {
                continue;
            }

            $grouped[$day][] = ['start' => $start, 'end' => $end];
        }

        foreach ($grouped as $day => $dayWindows) {
            usort($dayWindows, fn ($a, $b) => strcmp($a['start'], $b['start']));
            $grouped[$day] = $dayWindows;
        }

        return $grouped;
    }

    private function writePickupTermsMessage(Order $order, array $snapshot): void
    {
        $deadline = $order->pickup_deadline_at?->timezone(config('app.timezone'))->format('M j, Y g:i A');
        $location = $snapshot['location_name'] ?: 'merchant pickup location';
        $penalty = ((float) ($snapshot['cancellation_penalty_percent'] ?? 0)) > 0
            ? ' If the agreed pickup time passes and the order is cancelled for non-pickup, a cancellation penalty may be deducted from the paid amount.'
            : '';

        $body = "Pickup agreement created. Buyer can collect from {$location} any time before {$deadline}. Any extension, delivery change, or extra-cost agreement should be confirmed in this order chat.{$penalty}";

        $message = $order->messages()->create([
            'sender_id' => $order->merchant?->user_id ?: $order->buyer_id,
            'receiver_id' => $order->buyer_id,
            'type' => 'system',
            'body' => $body,
            'payload' => [
                'action_type' => 'pickup_terms_created',
                'acting_as' => 'merchant',
                'pickup_ready_at' => $order->pickup_ready_at?->toISOString(),
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
                'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
                'pickup_policy_snapshot' => $snapshot,
            ],
        ]);
        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();
    }

    private function writeActionMessage(Order $order, array $payload): Message
    {
        $message = $order->messages()->create([
            'sender_id' => $payload['sender_id'],
            'receiver_id' => $payload['receiver_id'],
            'type' => 'action',
            'body' => $payload['body'],
            'payload' => collect($payload)
                ->except(['sender_id', 'receiver_id', 'body'])
                ->all(),
        ]);

        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();

        return $message;
    }
}
