<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\ProviderEvent;
use App\Models\RetailAuditLog;
use App\Models\Transaction;
use App\Services\EntitlementService;
use App\Services\MarketplaceSettlementService;
use App\Services\PickupAgreementService;
use App\Services\SmsService;
use App\Services\SubscriptionRenewalService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Applies only provider events that have already passed callback authentication.
 * No method in this class creates, credits, debits, or transfers a platform balance.
 */
class PaymentCallbackProcessor
{
    public function __construct(
        private readonly MarketplaceSettlementService $settlements,
        private readonly EntitlementService $entitlementService,
        private readonly SmsService $smsService,
    ) {}

    public function processVerifiedEvent(PaymentEvent $event, ProviderEvent $providerEvent): void
    {
        if (! $providerEvent->signature_valid || $event->direction !== 'payin') {
            return;
        }

        $attempt = PaymentAttempt::query()->with(['order', 'provider', 'channel'])->where('takeer_reference', $event->takeerReference)->first();
        if (! $attempt) {
            $providerEvent->update(['validation_state' => 'review', 'processing_result' => 'attempt_not_found']);
            return;
        }

        if ((int) $attempt->payment_provider_id !== (int) $providerEvent->payment_provider_id) {
            $providerEvent->update(['validation_state' => 'rejected', 'processing_result' => 'provider_mismatch']);
            return;
        }
        if ($attempt->provider?->key && strcasecmp((string) $attempt->provider->key, (string) $event->provider) !== 0) {
            $providerEvent->update(['validation_state' => 'rejected', 'processing_result' => 'provider_key_mismatch']);
            return;
        }
        if ($event->channelKey && $attempt->channel?->key && $event->channelKey !== $attempt->channel->key) {
            $providerEvent->update(['validation_state' => 'rejected', 'processing_result' => 'channel_mismatch']);
            return;
        }

        try {
            if ($event->isSuccessful()) {
                $this->handleConfirmedPayment($attempt, $event, $providerEvent);
                $providerEvent->update(['validation_state' => 'processed', 'processing_result' => 'payment_confirmed', 'processed_at' => now()]);
                return;
            }

            if ($event->isFailed()) {
                $this->settlements->failPayment($attempt->order, $attempt, $event);
                $providerEvent->update(['validation_state' => 'processed', 'processing_result' => 'payment_failed', 'processed_at' => now()]);
                return;
            }

            $providerEvent->update(['validation_state' => 'pending', 'processing_result' => 'provider_status_pending']);
        } catch (\Throwable $exception) {
            $providerEvent->update([
                'validation_state' => 'review',
                'processing_result' => 'validation_failed',
                'validation_errors' => ['payment' => $exception->getMessage()],
            ]);
            Log::warning('Provider payment event requires operations review.', [
                'provider_event_id' => $providerEvent->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    public function handleConfirmedPayment(PaymentAttempt $attempt, PaymentEvent $event, ?ProviderEvent $providerEvent = null): void
    {
        $order = $attempt->order;
        if (! $order || $attempt->state === 'confirmed') {
            return;
        }

        $settlement = $this->settlements->confirmPayment($order, $attempt, $event);

        if ($this->isRetailCreditPaymentOrder($order)) {
            $this->handleRetailCreditPayment($order, $event->providerReference ?: $order->transaction_ref, $event->provider);
            return;
        }

        if ($this->isPickupFeePaymentOrder($order)) {
            $this->handlePickupFeePayment($order, $event->providerReference ?: $order->transaction_ref, $event->provider);
            return;
        }

        DB::afterCommit(function () use ($order): void {
            $fresh = $order->fresh(['buyer', 'merchant.user', 'product', 'delivery']);
            if (! $fresh) {
                return;
            }

            if ($fresh->product) {
                event(new \App\Events\OrderPaid($fresh->fresh(['product', 'buyer'])));
            }

            if (! $fresh->requiresPhysicalFulfillment()) {
                $this->entitlementService->grantForOrder($fresh->fresh(['product']));
                if ($fresh->purchasable_type === 'subscription_plan') {
                    $subscription = app(SubscriptionRenewalService::class)->createOrExtendFromOrder($fresh);
                    $this->entitlementService->grantForSubscription($subscription);
                }
                $this->sendDigitalAccessSms($fresh);
            }

            if ($fresh->requiresPhysicalFulfillment()) {
                if ($fresh->is_inquiry) {
                    $fresh->markPhysicalAgreement([
                        'total_paid' => (float) $fresh->total_paid,
                        'notes' => 'Buyer accepted the quoted physical order and the PSP confirmed payment.',
                    ]);
                }
                if ($fresh->buyer?->phone_number) {
                    $this->smsService->sendPhysicalPaymentHeldToBuyer($fresh->buyer->phone_number, (string) ($fresh->public_id ?: $fresh->id), (float) $fresh->total_paid, $fresh->buyer_id);
                }
                if ($fresh->merchant?->user?->phone_number) {
                    $this->smsService->sendPhysicalPaymentHeldToMerchant($fresh->merchant->user->phone_number, (string) ($fresh->public_id ?: $fresh->id), (float) $fresh->total_paid, $fresh->merchant->user_id);
                }
            }

            $fresh->loadMissing('product');
            \App\Models\ServiceRequest::query()->where('payment_order_id', $fresh->id)->update([
                'payment_status' => 'paid',
                'status' => 'confirmed',
            ]);
        });

        Log::info('Authenticated payment applied to order-specific settlement.', [
            'order_id' => $order->id,
            'settlement_id' => $settlement->id,
            'provider_event_id' => $providerEvent?->id,
        ]);
    }

    public function handleFailure(Order $order, string $reason = 'Payment failed'): void
    {
        $attempt = PaymentAttempt::query()->where('order_id', $order->id)->latest('id')->first();
        if ($attempt) {
            $event = new PaymentEvent(
                provider: (string) ($order->payment_gateway ?: 'unknown'),
                direction: 'payin',
                status: 'failed',
                providerReference: $order->gateway_ref,
                takeerReference: $attempt->takeer_reference,
                amount: (float) $order->total_paid,
                currency: (string) ($order->customer_currency_code ?: $order->merchant_currency_code ?: 'TZS'),
                failureReason: $reason,
            );
            $this->settlements->failPayment($order, $attempt, $event);
        }
    }

    /**
     * Non-production compatibility helper for legacy simulation callers.
     * Production payment confirmation must arrive through a recorded,
     * authenticated provider event.
     */
    public function handleSuccess(Order $order, string $gatewayRef, string $gateway): void
    {
        if (app()->environment('production')) {
            throw new \RuntimeException('Simulated payment confirmation is disabled in production.');
        }

        $providerId = $order->payment_provider_id
            ?: \App\Models\PaymentProvider::query()->where('key', $gateway)->value('id');
        if (! $providerId) {
            throw new \RuntimeException('A licensed PSP provider is required for the payment attempt.');
        }
        $providerKey = (string) (\App\Models\PaymentProvider::query()->whereKey($providerId)->value('key') ?: $gateway);

        $attempt = PaymentAttempt::query()->firstOrCreate(
            ['idempotency_key' => 'simulation-order-' . $order->id],
            [
                'order_id' => $order->id,
                'payment_provider_id' => $providerId,
                'takeer_reference' => (string) ($order->transaction_ref ?: 'SIM-' . $order->id),
                'expected_amount_minor' => (int) round((float) ($order->customer_total_amount ?? $order->total_paid) * 100),
                'expected_currency' => strtoupper((string) ($order->customer_currency_code ?: $order->merchant_currency_code ?: 'TZS')),
                'expected_country_code' => strtoupper((string) ($order->country_code ?: 'TZ')),
                'payment_phone_hash' => $order->payment_phone ? hash('sha256', preg_replace('/\D+/', '', $order->payment_phone)) : null,
                'state' => 'created',
                'request_snapshot' => ['source' => 'non_production_simulation'],
                'initiated_at' => now(),
            ],
        );

        $this->handleConfirmedPayment($attempt->fresh(['order']), new PaymentEvent(
            provider: $providerKey,
            direction: 'payin',
            status: 'success',
            providerReference: $gatewayRef,
            takeerReference: $attempt->takeer_reference,
            amount: (float) ($order->customer_total_amount ?? $order->total_paid),
            currency: $attempt->expected_currency,
            rawPayload: ['simulated' => true],
        ));
    }

    private function sendDigitalAccessSms(Order $order): void
    {
        $order->loadMissing(['buyer', 'product']);
        if (! $order->product || ! ($order->product->isDigital() || $order->product->isService())) {
            return;
        }
        $phone = $order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone;
        if ($phone) {
            $this->smsService->sendDigitalDeliveryNotification($phone, (string) $order->product->title, url('/orders'), $order->buyer_id, 'digital-delivery:' . ($order->public_id ?: $order->id));
        }
    }

    private function handleRetailCreditPayment(Order $paymentOrder, string $gatewayRef, string $gateway): void
    {
        $creditOrderId = (int) data_get($paymentOrder->extra_items, 'credit_order_id');
        if (! $creditOrderId) {
            return;
        }

        DB::transaction(function () use ($paymentOrder, $creditOrderId, $gatewayRef, $gateway): void {
            $creditOrder = Order::query()->whereKey($creditOrderId)->lockForUpdate()->first();
            if (! $creditOrder) {
                return;
            }
            $payableTotal = (float) ($creditOrder->counter_total ?? $creditOrder->grand_total ?? $creditOrder->total_paid ?? 0);
            $amount = min((float) $paymentOrder->total_paid, max($payableTotal - (float) $creditOrder->total_paid, 0));
            if ($amount <= 0) {
                return;
            }
            $remaining = max($payableTotal - ((float) $creditOrder->total_paid + $amount), 0);
            $creditOrder->update([
                'total_paid' => round((float) $creditOrder->total_paid + $amount, 2),
                'payment_status' => $remaining <= 0 ? 'payment_confirmed' : 'pending',
            ]);
            $paymentOrder->update(['payment_status' => 'payment_confirmed', 'gateway_ref' => $gatewayRef, 'payment_gateway' => $gateway]);
            $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($paymentOrder, $amount);
            Transaction::query()->firstOrCreate(['reference' => $gatewayRef], [
                'user_id' => $paymentOrder->buyer_id,
                'merchant_id' => $paymentOrder->merchant_id,
                'order_id' => $paymentOrder->id,
                'type' => 'order_revenue',
                ...$fee['snapshot'],
                'gross_amount' => $amount,
                'fee_amount' => $fee['fee_amount'],
                'net_amount' => $fee['net_amount'],
                'tax_amount' => $fee['tax_amount'],
            ]);
            RetailAuditLog::create([
                'merchant_id' => $creditOrder->merchant_id,
                'staff_id' => null,
                'user_id' => $paymentOrder->buyer_id,
                'action' => 'OUTSTANDING_BALANCE_PAYMENT',
                'description' => 'Online payment collected for a POS order.',
                'metadata' => ['order_id' => $creditOrder->id, 'payment_order_id' => $paymentOrder->id, 'amount' => $amount, 'remaining_balance' => $remaining, 'provider_reference' => $gatewayRef],
            ]);
        });
    }

    private function handlePickupFeePayment(Order $paymentOrder, string $gatewayRef, string $gateway): void
    {
        DB::transaction(function () use ($paymentOrder, $gatewayRef, $gateway): void {
            $paymentOrder = Order::query()->whereKey($paymentOrder->id)->lockForUpdate()->firstOrFail();
            $parent = Order::query()->with(['merchant.user', 'buyer'])->whereKey((int) data_get($paymentOrder->extra_items, 'parent_order_id'))->lockForUpdate()->firstOrFail();
            $feeType = data_get($paymentOrder->extra_items, 'type');
            if ($feeType === 'pickup_delivery_fee') {
                app(PickupAgreementService::class)->markDeliveryConversionPaid($paymentOrder, $gatewayRef, $gateway);
            } else {
                app(PickupAgreementService::class)->markExtraChargePaid($paymentOrder, $gatewayRef, $gateway);
            }
            $paymentOrder->update(['payment_status' => 'payment_confirmed', 'gateway_ref' => $gatewayRef, 'payment_gateway' => $gateway]);
            Transaction::query()->firstOrCreate(['reference' => $gatewayRef . '-PICKUP-FEE-' . $paymentOrder->id], [
                'user_id' => $paymentOrder->buyer_id,
                'merchant_id' => $paymentOrder->merchant_id,
                'order_id' => $paymentOrder->id,
                'type' => 'order_revenue',
                'fee_policy_name' => 'Order-specific delivery fee passthrough',
                'fee_policy_type' => 'fixed',
                'currency_code' => $paymentOrder->merchant_currency_code ?: $parent->merchant_currency_code ?: 'TZS',
                'gross_amount' => $paymentOrder->total_paid,
                'fee_amount' => 0,
                'provider_cost_amount' => 0,
                'takeer_margin_amount' => 0,
                'net_amount' => $paymentOrder->total_paid,
                'tax_amount' => 0,
            ]);
        });
    }

    private function isRetailCreditPaymentOrder(Order $order): bool
    {
        return (int) data_get($order->extra_items, 'credit_order_id') > 0;
    }

    private function isPickupFeePaymentOrder(Order $order): bool
    {
        return in_array(data_get($order->extra_items, 'type'), ['extra_charge', 'pickup_delivery_fee'], true)
            && (int) data_get($order->extra_items, 'parent_order_id') > 0;
    }
}
