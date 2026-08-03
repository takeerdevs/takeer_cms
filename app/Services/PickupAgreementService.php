<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Models\ExtraCharge;
use App\Models\MerchantLocation;
use App\Models\Message;
use App\Models\Order;
use App\Models\RefundRequest;
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

        if (!in_array($order->payment_status, ['pending_fulfillment', 'payment_confirmed'], true)) {
            return null;
        }

        if ($order->pickup_policy_snapshot && $order->pickup_deadline_at) {
            return $order;
        }

        $location = $this->resolvePickupLocation($order);
        $existingSnapshot = $order->pickup_policy_snapshot ?: [];
        $buyerSlot = $existingSnapshot['buyer_requested_slot'] ?? null;
        // The checkout snapshot is the source of truth for the buyer's
        // disclosed pickup policy. Merchant settings may change after the
        // order is created, so do not overwrite the accepted penalty with a
        // later location edit.
        $snapshot = array_merge($this->buildPolicySnapshot($order, $location), $existingSnapshot);
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

            if ($order->pickup_completed_at || in_array($order->payment_status, ['paid_out', 'refunded', 'refund_pending'], true)) {
                return $order;
            }

            if (! in_array($order->payment_status, ['pending_fulfillment', 'payment_confirmed', 'release_eligible'], true)) {
                abort(422, 'Only a paid, unsettled pickup order can be cancelled after the pickup deadline.');
            }

            $settlement = $order->settlement()->lockForUpdate()->first();
            if (! $settlement || in_array($settlement->settlement_state, ['release_requested', 'payout_processing', 'paid_out', 'refund_requested', 'refunded'], true)) {
                abort(422, 'This pickup order is already in provider settlement or refund processing.');
            }

            if (!$order->pickup_deadline_at || $order->pickup_deadline_at->isFuture()) {
                abort(422, 'Pickup deadline has not passed yet.');
            }

            $snapshot = $order->pickup_policy_snapshot ?: [];
            $percent = max(0, min(100, (float) ($snapshot['cancellation_penalty_percent'] ?? 0)));
            $paidAmount = round(max(0, (int) $settlement->buyer_paid_amount_minor) / 100, 2);
            $penaltyAmount = round($paidAmount * ($percent / 100), 2);
            $refundAmount = max(0, round($paidAmount - $penaltyAmount, 2));

            $order->releaseInventory();

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

            $extraChargeOrders = Order::query()
                ->where('merchant_id', $order->merchant_id)
                ->whereIn('payment_status', ['pending_fulfillment', 'payment_confirmed'])
                ->where('extra_items->type', 'extra_charge')
                ->where('extra_items->parent_order_id', $order->id)
                ->lockForUpdate()
                ->get();

            foreach ($extraChargeOrders as $feeOrder) {
                $feeOrder->forceFill([
                    'payment_status' => 'release_eligible',
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

        $extensionId = (string) Str::uuid();

        $snapshot['pending_extension'] = [
            'id' => $extensionId,
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
            'extension_id' => $extensionId,
        ]);

        return $order->fresh(['delivery']);
    }

    public function resolveExtension(Order $order, int $merchantUserId, string $decision, ?Carbon $approvedDeadlineAt = null, ?string $note = null, ?string $extensionId = null): Order
    {
        $order->loadMissing(['delivery', 'buyer', 'merchant.user']);
        $snapshot = $order->pickup_policy_snapshot ?: [];
        $pending = $snapshot['pending_extension'] ?? null;

        if (!$pending || ($pending['status'] ?? null) !== 'pending') {
            abort(422, 'No pending pickup extension request found.');
        }

        if ($extensionId && !hash_equals((string) ($pending['id'] ?? ''), $extensionId)) {
            abort(422, 'This pickup extension request is no longer active.');
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
                'extension_id' => $pending['id'] ?? null,
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
            'extension_id' => $pending['id'] ?? null,
        ]);

        return $order->fresh(['delivery']);
    }

    public function proposeExtraCharge(Order $order, int $merchantUserId, ?float $amount = null, ?string $note = null): Order
    {
        $order->loadMissing(['delivery', 'buyer', 'merchant.user']);
        $snapshot = $order->pickup_policy_snapshot ?: [];

        if ($order->delivery?->delivery_type !== 'self_pickup') {
            abort(422, 'Extra pickup costs apply only to self-pickup orders.');
        }

        if (!in_array($order->payment_status, ['pending_fulfillment', 'payment_confirmed', 'release_eligible'], true)) {
            abort(422, 'Order must be paid before adding an extra pickup cost.');
        }

        if ($order->pickup_completed_at || in_array($order->payment_status, ['paid_out', 'refunded', 'refund_pending'], true)) {
            abort(422, 'This pickup order is already closed.');
        }

        $amount = $amount !== null ? (float) $amount : 0.0;

        if ($amount <= 0) {
            abort(422, 'Extra cost amount must be greater than zero.');
        }

        $active = $snapshot['active_extra_charge'] ?? null;
        $existingCharge = null;
        if (($active['status'] ?? null) === 'proposed' && !empty($active['id'])) {
            $existingCharge = ExtraCharge::query()
                ->where('order_id', $order->id)
                ->where('public_id', (string) $active['id'])
                ->where('status', 'proposed')
                ->first();
        }

        $extraCharge = $existingCharge ?: new ExtraCharge([
            'public_id' => (($active['status'] ?? null) === 'proposed' && !empty($active['id']))
                ? (string) $active['id']
                : (string) Str::uuid(),
            'order_id' => $order->id,
            'merchant_id' => $order->merchant_id,
            'buyer_id' => $order->buyer_id,
            'proposed_by_user_id' => $merchantUserId,
            'context' => 'pickup_chat',
            'charge_type' => 'agreement',
            'proposed_at' => now(),
        ]);
        $extraCharge->fill([
            'description' => $note,
            'amount' => $amount,
            'currency_code' => $order->merchant_currency_code ?: 'TZS',
            'status' => 'proposed',
            'payment_order_id' => null,
            'accepted_by_user_id' => null,
            'accepted_at' => null,
            'paid_at' => null,
            'removed_at' => null,
            'removed_by_user_id' => null,
            'metadata' => [
                'source' => 'pickup_extra_charge',
                'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
            ],
        ])->save();

        $snapshot['active_extra_charge'] = [
            'id' => $extraCharge->public_id,
            'status' => 'proposed',
            'amount' => $amount,
            'currency' => $order->merchant_currency_code ?: 'TZS',
            'note' => $note,
            'proposed_by' => $merchantUserId,
            'proposed_at' => $extraCharge->proposed_at?->toISOString() ?: now()->toISOString(),
            'updated_at' => now()->toISOString(),
            'extra_charge_id' => $extraCharge->id,
        ];

        $order->forceFill([
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $merchantUserId,
            'receiver_id' => $order->buyer_id,
            'body' => 'Merchant proposed an extra agreed cost.',
            'action_type' => 'extra_charge_proposed',
            'acting_as' => 'merchant',
            'amount' => $amount,
            'currency' => $order->merchant_currency_code ?: 'TZS',
            'note' => $note,
            'proposal_id' => $extraCharge->public_id,
            'extra_charge_id' => $extraCharge->id,
            'fee_type' => 'agreement',
            'pickup_deadline_at' => $order->pickup_deadline_at?->toISOString(),
            'pickup_grace_ends_at' => $order->pickup_grace_ends_at?->toISOString(),
        ]);

        return $order->fresh(['delivery']);
    }

    public function removeExtraChargeProposal(Order $order, int $merchantUserId): Order
    {
        $order->loadMissing(['delivery', 'buyer', 'merchant.user']);
        $snapshot = $order->pickup_policy_snapshot ?: [];
        $active = $snapshot['active_extra_charge'] ?? null;

        if ($order->delivery?->delivery_type !== 'self_pickup') {
            abort(422, 'Extra pickup costs apply only to self-pickup orders.');
        }

        if (($active['status'] ?? null) !== 'proposed') {
            abort(422, 'No editable extra cost proposal is waiting.');
        }

        if (!empty($active['id'])) {
            ExtraCharge::query()
                ->where('order_id', $order->id)
                ->where('public_id', (string) $active['id'])
                ->where('status', 'proposed')
                ->update([
                    'status' => 'removed',
                    'removed_at' => now(),
                    'removed_by_user_id' => $merchantUserId,
                ]);
        }

        $snapshot['active_extra_charge'] = [
            ...$active,
            'status' => 'removed',
            'removed_at' => now()->toISOString(),
            'removed_by' => $merchantUserId,
        ];

        $order->forceFill([
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $merchantUserId,
            'receiver_id' => $order->buyer_id,
            'body' => 'Merchant removed the extra cost proposal.',
            'action_type' => 'extra_charge_removed',
            'acting_as' => 'merchant',
            'amount' => (float) ($active['amount'] ?? 0),
            'currency' => $order->merchant_currency_code ?: 'TZS',
            'proposal_id' => $active['id'] ?? null,
            'extra_charge_id' => $active['extra_charge_id'] ?? null,
        ]);

        return $order->fresh(['delivery']);
    }

    public function createExtraChargePaymentOrder(Order $order, int $buyerUserId, ?string $paymentPhone = null, ?string $proposalId = null): Order
    {
        $order->loadMissing(['delivery', 'merchant.user', 'buyer', 'product']);
        $snapshot = $order->pickup_policy_snapshot ?: [];
        $active = $snapshot['active_extra_charge'] ?? null;

        if (!in_array($active['status'] ?? null, ['proposed', 'payment_pending'], true)) {
            abort(422, 'No extra cost proposal is waiting for acceptance.');
        }

        if ($proposalId && !hash_equals((string) ($active['id'] ?? ''), $proposalId)) {
            abort(422, 'This extra cost proposal is no longer active.');
        }

        if ($order->buyer_id !== $buyerUserId) {
            abort(403, 'Unauthorized.');
        }

        $extraCharge = ExtraCharge::query()
            ->where('order_id', $order->id)
            ->where('public_id', (string) ($active['id'] ?? ''))
            ->whereIn('status', ['proposed', 'payment_pending'])
            ->first();

        if (! $extraCharge) {
            abort(422, 'This extra cost proposal is no longer active.');
        }

        if ($extraCharge->payment_order_id) {
            $existing = Order::query()->find($extraCharge->payment_order_id);
            if ($existing && $existing->payment_status === 'pending') {
                return $existing;
            }
        }

        $amount = (float) $extraCharge->amount;
        if ($amount <= 0) {
            abort(422, 'Extra cost amount must be greater than zero.');
        }

        $paymentOrder = Order::query()->create([
            'buyer_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'product_id' => $order->product_id,
            'variant_id' => $order->variant_id,
            'purchasable_type' => 'extra_charge',
            'purchasable_id' => $extraCharge->id,
            'order_kind' => 'one_time',
            'quantity' => 1,
            'unit_price' => $amount,
            'total_paid' => $amount,
            'merchant_currency_code' => $order->merchant_currency_code,
            'customer_currency_code' => $order->customer_currency_code,
            'merchant_total_amount' => $amount,
            'customer_total_amount' => $amount,
            'payment_status' => 'pending',
            'payment_gateway' => $order->payment_gateway,
            'payment_provider_id' => $order->payment_provider_id,
            'payment_provider_channel_id' => $order->payment_provider_channel_id,
            'payment_channel_snapshot' => $order->payment_channel_snapshot,
            'money_quote_snapshot' => $order->money_quote_snapshot,
            'payment_phone' => $paymentPhone ?: $order->payment_phone ?: $order->account_phone,
            'account_phone' => $order->account_phone,
            'country_code' => $order->country_code,
            'source' => 'online',
            'payment_mode' => 'online_psp',
            'transaction_ref' => 'EXTRA-' . $order->id . '-' . strtoupper(Str::random(10)),
            'extra_items' => [
                'type' => 'extra_charge',
                'parent_order_id' => $order->id,
                'parent_public_id' => $order->public_id,
                'extra_charge_id' => $extraCharge->id,
                'proposal_id' => $active['id'] ?? null,
            ],
        ]);

        $extraCharge->forceFill([
            'status' => 'payment_pending',
            'accepted_by_user_id' => $buyerUserId,
            'accepted_at' => now(),
            'payment_order_id' => $paymentOrder->id,
        ])->save();

        $snapshot['active_extra_charge'] = [
            ...$active,
            'status' => 'payment_pending',
            'accepted_at' => now()->toISOString(),
            'accepted_by' => $buyerUserId,
            'payment_order_id' => $paymentOrder->id,
            'extra_charge_id' => $extraCharge->id,
        ];

        $order->forceFill([
            'pickup_policy_snapshot' => $snapshot,
        ])->save();

        $this->writeActionMessage($order, [
            'sender_id' => $buyerUserId,
            'receiver_id' => $order->merchant?->user_id,
            'body' => 'Buyer accepted the extra cost proposal and started payment.',
            'action_type' => 'extra_charge_payment_started',
            'acting_as' => 'buyer',
            'amount' => $amount,
            'currency' => $order->merchant_currency_code ?: 'TZS',
            'payment_order_id' => $paymentOrder->id,
            'proposal_id' => $active['id'] ?? null,
            'extra_charge_id' => $extraCharge->id,
        ]);

        return $paymentOrder;
    }

    public function markExtraChargePaid(Order $paymentOrder, string $gatewayRef, string $gateway): Order
    {
        $parentOrderId = (int) data_get($paymentOrder->extra_items, 'parent_order_id');
        $paymentType = data_get($paymentOrder->extra_items, 'type');
        if (!$parentOrderId || $paymentType !== 'extra_charge') {
            abort(422, 'This is not an extra charge payment order.');
        }

        $parent = Order::query()->with(['delivery', 'merchant.user', 'buyer'])->lockForUpdate()->findOrFail($parentOrderId);
        $amount = (float) $paymentOrder->total_paid;
        $snapshot = $parent->pickup_policy_snapshot ?: [];
        $active = $snapshot['active_extra_charge'] ?? [];
        $paymentProposalId = (string) data_get($paymentOrder->extra_items, 'proposal_id', '');
        $isActiveProposalPayment = $paymentProposalId !== '' && hash_equals((string) ($active['id'] ?? ''), $paymentProposalId);
        $extraCharge = null;
        $extraChargeId = (int) data_get($paymentOrder->extra_items, 'extra_charge_id');
        if ($extraChargeId > 0) {
            $extraCharge = ExtraCharge::query()->whereKey($extraChargeId)->where('order_id', $parent->id)->first();
        }

        $paymentOrder->forceFill([
            'payment_status' => 'payment_confirmed',
            'gateway_ref' => $gatewayRef,
            'payment_gateway' => $gateway,
        ])->save();

        if ($extraCharge) {
            $extraCharge->forceFill([
                'status' => 'paid_held',
                'paid_at' => now(),
                'payment_order_id' => $paymentOrder->id,
            ])->save();
        }

        if ($isActiveProposalPayment) {
            $snapshot['active_extra_charge'] = [
                ...$active,
                'status' => 'paid_held',
                'paid_at' => now()->toISOString(),
                'payment_order_id' => $paymentOrder->id,
                'extra_charge_id' => $extraCharge?->id ?: ($active['extra_charge_id'] ?? null),
            ];

            $parent->forceFill([
                'pickup_policy_snapshot' => $snapshot,
            ])->save();
        }

        $this->writeActionMessage($parent, [
            'sender_id' => $parent->buyer_id,
            'receiver_id' => $parent->merchant?->user_id,
            'body' => 'Extra charge payment was confirmed by the payment provider.',
            'action_type' => 'extra_charge_paid_held',
            'acting_as' => 'buyer',
            'amount' => $amount,
            'currency' => $parent->merchant_currency_code ?: 'TZS',
            'payment_order_id' => $paymentOrder->id,
            'proposal_id' => $paymentProposalId ?: null,
            'extra_charge_id' => $extraCharge?->id ?: null,
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
            'payment_gateway' => $order->payment_gateway,
            'payment_provider_id' => $order->payment_provider_id,
            'payment_provider_channel_id' => $order->payment_provider_channel_id,
            'payment_channel_snapshot' => $order->payment_channel_snapshot,
            'money_quote_snapshot' => $order->money_quote_snapshot,
            'payment_phone' => $paymentPhone ?: $order->payment_phone ?: $order->account_phone,
            'account_phone' => $order->account_phone,
            'country_code' => $order->country_code,
            'source' => 'online',
            'payment_mode' => 'online_psp',
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
            'payment_status' => 'payment_confirmed',
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
            'body' => 'Delivery conversion fee was confirmed by the payment provider.',
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

        $snapshotLocationId = data_get($order->pickup_policy_snapshot, 'location_id');
        if ($snapshotLocationId) {
            return MerchantLocation::query()
                ->whereKey((int) $snapshotLocationId)
                ->where('merchant_id', $order->merchant_id)
                ->first();
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
            'cancellation_penalty_percent' => max(0, min(99.99, (float) ($location?->pickup_cancellation_penalty_percent ?? 0))),
            'pickup_advance_days' => $location?->pickup_advance_days ?? 2,
            'product_note' => $order->product?->pickup_policy_note,
            'accepted_at' => now()->toISOString(),
        ];
    }

    private function createPickupRefundRequest(Order $order, float $refundAmount, float $penaltyAmount, float $penaltyPercent, ?string $reason = null): ?RefundRequest
    {
        if ($refundAmount < 0) {
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
                'provider_refund_required' => $refundAmount > 0,
                'provider_settlement_instruction' => $penaltyAmount > 0
                    ? 'The PSP must retain or allocate the disclosed penalty under its approved marketplace settlement structure.'
                    : 'No penalty is retained; the PSP refund covers the full paid amount.',
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
        $merchantTimezone = $order->merchant?->defaultTimezone() ?: config('app.timezone', 'UTC');
        $deadline = $order->pickup_deadline_at?->timezone($merchantTimezone)->format('M j, Y g:i A');
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
