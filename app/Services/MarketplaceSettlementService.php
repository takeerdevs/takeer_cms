<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderSettlement;
use App\Models\PaymentAttempt;
use App\Models\ProviderPayout;
use App\Models\ProviderPayoutAllocation;
use App\Models\ProviderRefund;
use App\Models\ProviderEvent;
use App\Models\SettlementTransition;
use App\Payments\PaymentEvent;
use App\Jobs\SubmitProviderPayout;
use App\Jobs\SubmitProviderRefund;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class MarketplaceSettlementService
{
    public const STATES = [
        'awaiting_payment', 'payment_confirmed', 'pending_fulfillment', 'release_eligible',
        'release_requested', 'payout_processing', 'paid_out', 'refund_requested', 'refunded',
        'disputed', 'provider_exception', 'compliance_hold', 'closed',
    ];

    public function createForAttempt(Order $order, PaymentAttempt $attempt): OrderSettlement
    {
        $existing = OrderSettlement::query()->where('order_id', $order->id)->first();
        if ($existing) {
            return $existing;
        }

        $providerGross = (float) $attempt->expected_amount_minor / 100;
        $fee = app(FeePolicyService::class)->calculateForOrder($order, $providerGross);
        $grossMinor = (int) $attempt->expected_amount_minor;
        $sellerMinor = max(0, $this->minor($fee['net_amount']));
        $feeMinor = max(0, $grossMinor - $sellerMinor);
        $releaseRule = $this->releaseRule($order);

        return DB::transaction(function () use ($order, $attempt, $grossMinor, $sellerMinor, $feeMinor, $fee, $releaseRule): OrderSettlement {
            $settlement = OrderSettlement::query()->create([
                'order_id' => $order->id,
                'merchant_id' => $order->merchant_id,
                'payment_provider_id' => $attempt->payment_provider_id,
                'payment_attempt_id' => $attempt->id,
                'currency' => strtoupper((string) $attempt->expected_currency),
                'buyer_paid_amount_minor' => $grossMinor,
                'seller_amount_minor' => $sellerMinor,
                'takeer_fee_amount_minor' => $feeMinor,
                'provider_fee_amount_minor' => data_get($fee, 'snapshot.provider_cost_amount') !== null
                    ? $this->minor(data_get($fee, 'snapshot.provider_cost_amount'))
                    : null,
                'tax_amount_minor' => $fee['tax_amount'] !== null ? $this->minor($fee['tax_amount']) : null,
                'settlement_state' => 'awaiting_payment',
                'release_rule_snapshot' => $releaseRule + ['fee_snapshot' => $fee['snapshot']],
            ]);

            $this->transition($settlement, null, 'awaiting_payment', 'payment_attempt_created', evidence: ['payment_attempt_id' => $attempt->id]);
            return $settlement;
        });
    }

    public function confirmPayment(Order $order, PaymentAttempt $attempt, PaymentEvent $event): OrderSettlement
    {
        return DB::transaction(function () use ($order, $attempt, $event): OrderSettlement {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $attempt = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            $settlement = $this->createForAttempt($order, $attempt);
            $settlement = OrderSettlement::query()->whereKey($settlement->id)->lockForUpdate()->firstOrFail();

            $this->assertExactPayment($attempt, $event);
            if (in_array($settlement->settlement_state, ['payment_confirmed', 'pending_fulfillment', 'release_eligible', 'release_requested', 'payout_processing', 'paid_out'], true)) {
                return $settlement;
            }

            $isPhysical = $order->requiresPhysicalFulfillment();
            $nextState = $isPhysical ? 'pending_fulfillment' : 'release_eligible';
            $orderStatus = $isPhysical ? 'pending_fulfillment' : 'payment_confirmed';
            $order->update([
                'payment_status' => $orderStatus,
                'gateway_ref' => $event->providerReference,
                'payment_gateway' => $event->provider,
            ]);
            $attempt->update([
                'state' => 'confirmed',
                'provider_transaction_reference' => $event->providerReference,
                'confirmed_at' => now(),
                'response_snapshot' => $event->rawPayload,
            ]);

            $settlement->update([
                'settlement_state' => $nextState,
                'payout_eligible_amount_minor' => $isPhysical ? 0 : $settlement->seller_amount_minor,
                'release_eligible_at' => $isPhysical ? null : now(),
            ]);
            $this->transition($settlement, 'awaiting_payment', $nextState, 'authenticated_payment_confirmed', evidence: [
                'provider_reference' => $event->providerReference,
                'amount_minor' => $event->amount !== null ? $this->minor($event->amount) : null,
                'currency' => strtoupper((string) $event->currency),
            ]);

            return $settlement;
        });
    }

    public function failPayment(Order $order, PaymentAttempt $attempt, PaymentEvent $event): void
    {
        DB::transaction(function () use ($order, $attempt, $event): void {
            $attempt = PaymentAttempt::query()->whereKey($attempt->id)->lockForUpdate()->firstOrFail();
            if ($attempt->state === 'confirmed') {
                return;
            }
            $attempt->update(['state' => 'failed', 'failed_at' => now(), 'response_snapshot' => $event->rawPayload]);
            Order::query()->whereKey($order->id)->where('payment_status', 'pending')->update([
                'payment_status' => 'failed',
                'gateway_ref' => $event->providerReference,
                'payment_gateway' => $event->provider,
            ]);
            $order->releaseInventory();
        });
    }

    public function markReleaseEligible(OrderSettlement $settlement, string $reasonCode, array $evidence = []): OrderSettlement
    {
        return DB::transaction(function () use ($settlement, $reasonCode, $evidence): OrderSettlement {
            $settlement = OrderSettlement::query()->whereKey($settlement->id)->lockForUpdate()->firstOrFail();
            if (in_array($settlement->settlement_state, ['paid_out', 'payout_processing', 'release_requested'], true)) {
                return $settlement;
            }
            if ($settlement->settlement_state === 'refunded' || $settlement->settlement_state === 'disputed') {
                throw new RuntimeException('This order is not eligible for seller payout.');
            }
            $from = $settlement->settlement_state;
            $settlement->update([
                'settlement_state' => 'release_eligible',
                'payout_eligible_amount_minor' => $settlement->seller_amount_minor - $settlement->paid_out_amount_minor,
                'release_eligible_at' => $settlement->release_eligible_at ?: now(),
            ]);
            $this->transition($settlement, $from, 'release_eligible', $reasonCode, evidence: $evidence);
            return $settlement;
        });
    }

    public function createPayout(OrderSettlement $settlement): ProviderPayout
    {
        return DB::transaction(function () use ($settlement): ProviderPayout {
            $settlement = OrderSettlement::query()->with('merchant')->whereKey($settlement->id)->lockForUpdate()->firstOrFail();
            if (! in_array($settlement->settlement_state, ['release_eligible', 'release_requested', 'payout_processing'], true)) {
                throw new RuntimeException('Order is not release eligible for a provider payout.');
            }

            $existing = ProviderPayout::query()
                ->with('allocations')
                ->whereJsonContains('metadata->order_settlement_id', $settlement->id)
                ->first();
            if ($existing) {
                return $existing->fresh(['allocations']);
            }

            if ($settlement->paid_out_amount_minor >= $settlement->seller_amount_minor) {
                throw new RuntimeException('The order allocation has already been paid out.');
            }

            $profile = \App\Models\MarketplaceSellerPaymentProfile::query()
                ->where('merchant_id', $settlement->merchant_id)
                ->where('payment_provider_id', $settlement->payment_provider_id)
                ->lockForUpdate()
                ->first();
            if (! $profile || ! $profile->isPayoutReady()) {
                throw new RuntimeException('Seller PSP onboarding or beneficiary verification is incomplete.');
            }

            $amount = $settlement->seller_amount_minor - $settlement->paid_out_amount_minor;
            $payout = ProviderPayout::query()->firstOrCreate(
                ['provider_idempotency_key' => 'order-settlement-' . $settlement->id],
                [
                    'public_id' => (string) Str::uuid(),
                    'merchant_id' => $settlement->merchant_id,
                    'payment_provider_id' => $settlement->payment_provider_id,
                    'seller_payment_profile_id' => $profile->id,
                    'currency' => $settlement->currency,
                    'amount_minor' => $amount,
                    'state' => 'created',
                    'due_at' => now(),
                    'metadata' => ['order_settlement_id' => $settlement->id],
                ],
            );
            ProviderPayoutAllocation::query()->firstOrCreate([
                'provider_payout_id' => $payout->id,
                'order_settlement_id' => $settlement->id,
            ], ['amount_minor' => $amount]);
            if ($settlement->settlement_state === 'release_eligible') {
                $settlement->update(['settlement_state' => 'release_requested', 'release_requested_at' => now()]);
                $this->transition($settlement, 'release_eligible', 'release_requested', 'psp_payout_created', evidence: ['provider_payout_id' => $payout->id]);
            }

            return $payout->fresh(['allocations']);
        });
    }

    public function releaseAfterFulfillment(Order $order, string $reasonCode, array $evidence = []): ?ProviderPayout
    {
        $settlement = $order->settlement()->first();
        if (! $settlement) {
            return null;
        }
        $settlement = $this->markReleaseEligible($settlement, $reasonCode, $evidence);
        try {
            $payout = $this->createPayout($settlement);
            SubmitProviderPayout::dispatch($payout->id)->afterCommit();
            return $payout;
        } catch (RuntimeException $exception) {
            $settlement->update([
                'settlement_state' => 'compliance_hold',
                'hold_reason' => $exception->getMessage(),
            ]);
            return null;
        }
    }

    public function completePayout(ProviderPayout $payout, PaymentEvent $event, ProviderEvent $providerEvent): void
    {
        DB::transaction(function () use ($payout, $event, $providerEvent): void {
            $payout = ProviderPayout::query()->with('allocations.settlement')->whereKey($payout->id)->lockForUpdate()->firstOrFail();
            if ($payout->state === 'completed') {
                return;
            }
            $this->assertProviderAmountAndCurrency($event, $payout->amount_minor, $payout->currency, 'payout');
            $payout->update([
                'state' => 'completed',
                'provider_payout_reference' => $event->providerReference ?: $payout->provider_payout_reference,
                'completed_at' => now(),
                'last_provider_event_id' => $providerEvent->id,
            ]);
            foreach ($payout->allocations as $allocation) {
                $settlement = OrderSettlement::query()->whereKey($allocation->order_settlement_id)->lockForUpdate()->firstOrFail();
                $newPaid = $settlement->paid_out_amount_minor + $allocation->amount_minor;
                if ($newPaid > $settlement->payout_eligible_amount_minor + $settlement->paid_out_amount_minor) {
                    throw new RuntimeException('Provider payout exceeds the order allocation.');
                }
                $settlement->update([
                    'paid_out_amount_minor' => $newPaid,
                    'settlement_state' => 'paid_out',
                    'closed_at' => now(),
                ]);
                $this->transition($settlement, 'payout_processing', 'paid_out', 'authenticated_psp_payout_completed', evidence: [
                    'provider_payout_id' => $payout->id,
                    'provider_event_id' => $providerEvent->id,
                ]);
                $settlement->order()->update(['payment_status' => 'paid_out']);
            }
        });
    }

    public function failPayout(ProviderPayout $payout, PaymentEvent $event, ProviderEvent $providerEvent): void
    {
        $payout->update([
            'state' => 'failed',
            'provider_payout_reference' => $event->providerReference ?: $payout->provider_payout_reference,
            'failed_at' => now(),
            'failure_message' => $event->failureReason,
            'last_provider_event_id' => $providerEvent->id,
        ]);
        foreach ($payout->allocations as $allocation) {
            $settlement = $allocation->settlement;
            if ($settlement && $settlement->settlement_state === 'payout_processing') {
                $settlement->update(['settlement_state' => 'provider_exception', 'hold_reason' => 'PSP payout failed; provider status review required.']);
            }
        }
    }

    public function requestRefund(
        OrderSettlement $settlement,
        string $reasonCode,
        string $requestedByType = 'system',
        ?int $requestedById = null,
        ?int $requestedAmountMinor = null,
        ?string $idempotencyKey = null,
        array $metadata = [],
    ): ProviderRefund
    {
        return DB::transaction(function () use ($settlement, $reasonCode, $requestedByType, $requestedById, $requestedAmountMinor, $idempotencyKey, $metadata): ProviderRefund {
            $settlement = OrderSettlement::query()->lockForUpdate()->findOrFail($settlement->id);
            $remainingAmount = max(0, $settlement->buyer_paid_amount_minor - $settlement->refunded_amount_minor);
            $amount = $requestedAmountMinor ?? $remainingAmount;
            if ($amount <= 0) {
                throw new RuntimeException('The order has no refundable provider-held amount.');
            }
            if ($amount > $remainingAmount) {
                throw new RuntimeException('The requested refund exceeds the remaining refundable provider-held amount.');
            }

            $idempotencyKey ??= 'order-settlement-refund-' . $settlement->id;

            $refund = ProviderRefund::query()->firstOrCreate(
                ['provider_idempotency_key' => $idempotencyKey],
                [
                    'public_id' => (string) Str::uuid(),
                    'order_settlement_id' => $settlement->id,
                    'payment_provider_id' => $settlement->payment_provider_id,
                    'provider_transaction_reference' => (string) ($settlement->paymentAttempt?->provider_transaction_reference ?: $settlement->order?->gateway_ref ?: 'takeer-order-' . $settlement->order_id),
                    'amount_minor' => $amount,
                    'currency' => $settlement->currency,
                    'reason_code' => $reasonCode,
                    'state' => 'requested',
                    'requested_by_type' => $requestedByType,
                    'requested_by_id' => $requestedById,
                    'requested_at' => now(),
                    'metadata' => ['order_id' => $settlement->order_id] + $metadata,
                ],
            );

            if ($settlement->settlement_state !== 'refunded') {
                $from = $settlement->settlement_state;
                $settlement->update([
                    'settlement_state' => 'refund_requested',
                    'refund_requested_at' => now(),
                ]);
                $this->transition($settlement, $from, 'refund_requested', $reasonCode, $requestedByType, $requestedById, [
                    'provider_refund_id' => $refund->id,
                    'amount_minor' => $amount,
                ]);
            }

            SubmitProviderRefund::dispatch($refund->id)->afterCommit();
            return $refund->fresh();
        });
    }

    public function completeRefund(ProviderRefund $refund, PaymentEvent $event, ProviderEvent $providerEvent): void
    {
        DB::transaction(function () use ($refund, $event, $providerEvent): void {
            $refund = ProviderRefund::query()->lockForUpdate()->findOrFail($refund->id);
            if ($refund->state === 'completed') {
                return;
            }
            $settlement = OrderSettlement::query()->lockForUpdate()->findOrFail($refund->order_settlement_id);
            $this->assertProviderAmountAndCurrency($event, $refund->amount_minor, $refund->currency, 'refund');
            $newRefunded = $settlement->refunded_amount_minor + $refund->amount_minor;
            if ($newRefunded > $settlement->buyer_paid_amount_minor) {
                throw new RuntimeException('Provider refund exceeds the original order payment.');
            }
            $refund->update([
                'state' => 'completed',
                'provider_refund_reference' => $event->providerReference ?: $refund->provider_refund_reference,
                'completed_at' => now(),
                'last_provider_event_id' => $providerEvent->id,
            ]);
            $closeAfterRefund = (bool) data_get($refund->metadata, 'close_after_refund', false);
            $nextState = $closeAfterRefund || $newRefunded >= $settlement->buyer_paid_amount_minor
                ? ($newRefunded >= $settlement->buyer_paid_amount_minor ? 'refunded' : 'closed')
                : 'refund_requested';

            $settlement->update([
                'refunded_amount_minor' => $newRefunded,
                'settlement_state' => $nextState,
                'closed_at' => $nextState === 'refund_requested' ? null : now(),
            ]);
            $this->transition($settlement, 'refund_requested', $nextState, 'authenticated_psp_refund_completed', evidence: ['provider_refund_id' => $refund->id, 'provider_event_id' => $providerEvent->id, 'refunded_amount_minor' => $refund->amount_minor]);
            $settlement->order()->update(['payment_status' => $nextState === 'refund_requested' ? 'refund_pending' : 'refunded']);
        });
    }

    public function failRefund(ProviderRefund $refund, PaymentEvent $event, ProviderEvent $providerEvent): void
    {
        $refund->update([
            'state' => 'failed',
            'provider_refund_reference' => $event->providerReference ?: $refund->provider_refund_reference,
            'failed_at' => now(),
            'last_provider_event_id' => $providerEvent->id,
        ]);
        $refund->settlement?->update([
            'settlement_state' => 'provider_exception',
            'hold_reason' => 'PSP refund failed; provider status review required.',
        ]);
    }

    public function transition(OrderSettlement $settlement, ?string $from, string $to, string $reasonCode, ?string $actorType = 'system', ?int $actorId = null, array $evidence = []): void
    {
        SettlementTransition::query()->create([
            'order_settlement_id' => $settlement->id,
            'from_state' => $from,
            'to_state' => $to,
            'reason_code' => $reasonCode,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'evidence' => $evidence,
            'created_at' => now(),
        ]);
    }

    public function assertExactPayment(PaymentAttempt $attempt, PaymentEvent $event): void
    {
        if (! $event->providerReference || in_array(strtolower(trim((string) $event->providerReference)), ['n/a', 'null'], true)) {
            throw new RuntimeException('Provider payment reference is required.');
        }
        if ($event->amount === null || $this->minor($event->amount) !== (int) $attempt->expected_amount_minor) {
            throw new RuntimeException('Provider payment amount does not match the order expectation.');
        }
        if (! $event->currency || strtoupper($event->currency) !== strtoupper($attempt->expected_currency)) {
            throw new RuntimeException('Provider payment currency does not match the order expectation.');
        }
        $providerMerchantId = data_get($event->rawPayload, 'provider_merchant_id')
            ?? data_get($event->rawPayload, 'merchant_id')
            ?? data_get($event->rawPayload, 'submerchant_id');
        if ($providerMerchantId !== null && $attempt->provider_merchant_id !== null && (string) $providerMerchantId !== (string) $attempt->provider_merchant_id) {
            throw new RuntimeException('Provider seller identifier does not match the payment attempt.');
        }
        if ($event->providerReference && PaymentAttempt::query()
            ->where('payment_provider_id', $attempt->payment_provider_id)
            ->where('provider_transaction_reference', $event->providerReference)
            ->where($attempt->getKeyName(), '!=', $attempt->id)
            ->exists()) {
            throw new RuntimeException('Provider transaction reference is already linked to another payment attempt.');
        }
    }

    private function releaseRule(Order $order): array
    {
        if (! $order->requiresPhysicalFulfillment()) {
            return ['category' => 'instant_digital_or_service', 'condition' => 'verified_payment_and_entitlement'];
        }
        return ['category' => 'physical', 'condition' => 'buyer_receipt_or_delivery_proof_plus_review_window'];
    }

    private function minor(float|int|string|null $amount): int
    {
        return (int) round((float) ($amount ?? 0) * 100);
    }

    private function assertProviderAmountAndCurrency(PaymentEvent $event, int $expectedAmountMinor, string $expectedCurrency, string $movement): void
    {
        if ($event->amount === null || $this->minor($event->amount) !== $expectedAmountMinor) {
            throw new RuntimeException("Provider {$movement} amount does not match the order-specific instruction.");
        }
        if (! $event->currency || strtoupper($event->currency) !== strtoupper($expectedCurrency)) {
            throw new RuntimeException("Provider {$movement} currency does not match the order-specific instruction.");
        }
    }
}
