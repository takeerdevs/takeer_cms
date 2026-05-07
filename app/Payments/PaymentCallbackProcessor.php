<?php

namespace App\Payments;

use App\Models\Order;
use App\Models\RetailAuditLog;
use App\Models\SubscriptionInvoice;
use App\Models\Transaction;
use App\Models\UserSubscription;
use App\Services\EntitlementService;
use App\Services\PayoutPolicyService;
use App\Services\SmsService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Shared payment success/failure handler.
 *
 * This is the SINGLE place where business logic runs after any gateway
 * confirms payment — wallet crediting, entitlement grants, subscriptions.
 *
 * AzamPay callback → AzamPayCallbackController → PaymentCallbackProcessor
 * M-Pesa callback  → MpesaCallbackController   → PaymentCallbackProcessor
 * Flutterwave      → FlutterwaveCallbackController → PaymentCallbackProcessor
 *
 * This ensures all gateways share identical post-payment behaviour.
 */
class PaymentCallbackProcessor
{
    public function __construct(
        private readonly EntitlementService $entitlementService,
        private readonly SmsService $smsService,
    ) {}

    /**
     * Process a confirmed successful payment notification from any gateway.
     *
     * @param  Order   $order       The pending order that was paid.
     * @param  string  $gatewayRef  The gateway's own transaction reference number.
     * @param  string  $gateway     Gateway name e.g. "azampay", "mpesa_ke"
     */
    public function handleSuccess(Order $order, string $gatewayRef, string $gateway): void
    {
        if ($order->payment_status !== 'pending') {
            Log::warning("PaymentCallbackProcessor: Order [{$order->id}] is not pending (status: {$order->payment_status}). Skipping.");
            return;
        }

        if ($this->isRetailCreditPaymentOrder($order)) {
            $this->handleRetailCreditPayment($order, $gatewayRef, $gateway);
            return;
        }

        Log::info("PaymentCallbackProcessor: Processing success for order [{$order->id}] via [{$gateway}] ref [{$gatewayRef}].");

        DB::transaction(function () use ($order, $gatewayRef, $gateway) {
            $isPhysical = $order->requiresPhysicalFulfillment();
            $payoutPolicy = app(PayoutPolicyService::class)->resolveForOrder($order);
            $shouldHoldFunds = $isPhysical || (bool) $payoutPolicy['holds_funds'];

            if ($isPhysical && $order->is_inquiry) {
                $order->markPhysicalAgreement([
                    'total_paid' => (float) $order->total_paid,
                    'notes' => 'Buyer accepted the quoted physical order and gateway confirmed payment.',
                ]);
            }

            $order->update([
                'payment_status' => $isPhysical
                    ? 'awaiting_merchant_confirmation'
                    : ($shouldHoldFunds ? 'escrow_locked' : 'resolved_merchant_paid'),
                'gateway_ref'    => $gatewayRef,
                'payment_gateway' => $gateway,
                'merchant_confirmed_at' => $isPhysical ? now() : $order->merchant_confirmed_at,
            ]);

            // Log TRA-ready transaction record
            $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($order, (float) $order->total_paid);
            Transaction::create([
                'user_id'      => $order->buyer_id,
                'order_id'     => $order->id,
                'type'         => 'order_revenue',
                ...$fee['snapshot'],
                'gross_amount' => $order->total_paid,
                'fee_amount'   => $fee['fee_amount'],
                'net_amount'   => $fee['net_amount'],
                'tax_amount'   => $fee['tax_amount'],
                'reference'    => $gatewayRef,
            ]);

            $wallet = $order->merchant->user->wallet()->firstOrCreate(
                ['user_id' => $order->merchant->user_id],
                ['balance' => 0, 'frozen_balance' => 0]
            );

            if ($shouldHoldFunds) {
                // Freeze funds in merchant wallet until buyer, admin, or policy review releases them.
                $wallet->increment('frozen_balance', $order->total_paid);
                if (! $isPhysical) {
                    $this->entitlementService->grantForOrder($order->fresh(['product']));
                }
                if ($isPhysical) {
                    $order->loadMissing(['buyer', 'merchant.user', 'delivery']);
                    $publicId = (string) ($order->public_id ?: $order->id);
                    if ($order->buyer?->phone_number) {
                        $this->smsService->sendPhysicalPaymentHeldToBuyer($order->buyer->phone_number, $publicId, (float) $order->total_paid, $order->buyer_id);
                        if ($order->delivery?->delivery_type === 'self_pickup' && $order->delivery?->pickup_pin) {
                            $this->smsService->sendPickupPinToBuyer($order->buyer->phone_number, $publicId, (string) $order->delivery->pickup_pin, $order->buyer_id);
                        }
                    }
                    if ($order->merchant?->user?->phone_number) {
                        $this->smsService->sendPhysicalPaymentHeldToMerchant($order->merchant->user->phone_number, $publicId, (float) $order->total_paid, $order->merchant->user_id);
                    }
                }
            } else {
                // Credit merchant according to the resolved payout policy.
                $wallet->increment('balance', $fee['net_amount']);
                $this->entitlementService->grantForOrder($order->fresh(['product']));

                // Handle subscription activation
                if ($order->purchasable_type === 'subscription_plan') {
                    $subscription = $this->createOrRenewSubscription($order);
                    $this->entitlementService->grantForSubscription($subscription);
                }
            }

            \App\Models\ServiceRequest::query()
                ->where('payment_order_id', $order->id)
                ->update([
                    'payment_status' => 'paid',
                    'status' => 'confirmed',
                ]);
        });

        $this->sendDigitalAccessSms($order);

        // Fire events (outside transaction to avoid holding DB locks)
        if ($order->product) {
            event(new \App\Events\OrderPaid($order));
        }

        if ($order->product?->isPhysical()) {
            \App\Jobs\DispatchCourier::dispatch($order);
        }
    }

    /**
     * Process a confirmed failed/rejected payment from any gateway.
     *
     * @param  Order   $order
     * @param  string  $reason  Human-readable failure reason for logging.
     */
    public function handleFailure(Order $order, string $reason = 'Payment failed'): void
    {
        if ($order->payment_status !== 'pending') {
            Log::warning("PaymentCallbackProcessor: Order [{$order->id}] is not pending. Skipping failure handler.");
            return;
        }

        if ($this->isRetailCreditPaymentOrder($order)) {
            $order->update(['payment_status' => 'failed']);
            Log::info("PaymentCallbackProcessor: POS credit payment order [{$order->id}] failed. Reason: {$reason}");
            return;
        }

        Log::info("PaymentCallbackProcessor: Marking order [{$order->id}] as failed. Reason: {$reason}");

        $order->update(['payment_status' => 'failed']);

        $order->releaseInventory();
    }

    private function createOrRenewSubscription(Order $order): UserSubscription
    {
        $plan  = $order->resolved_purchasable;
        $start = now();
        $end   = match ($plan->billing_interval) {
            'hourly'  => now()->addHours((int) $plan->interval_count),
            'daily'   => now()->addDays((int) $plan->interval_count),
            'weekly'  => now()->addWeeks((int) $plan->interval_count),
            default   => now()->addMonths((int) $plan->interval_count),
        };

        $subscription = UserSubscription::create([
            'user_id'              => $order->buyer_id,
            'merchant_id'         => $order->merchant_id,
            'subscription_plan_id' => $plan->id,
            'status'              => 'active',
            'auto_renew'          => true,
            'started_at'          => $start,
            'current_period_start' => $start,
            'current_period_end'   => $end,
            'next_billing_at'     => $end,
        ]);

        SubscriptionInvoice::create([
            'user_subscription_id' => $subscription->id,
            'order_id'            => $order->id,
            'amount'              => $order->total_paid,
            'status'              => 'paid',
            'billed_for_start'    => $start,
            'billed_for_end'      => $end,
            'paid_at'             => now(),
            'reference'           => 'SUB-' . $order->transaction_ref,
        ]);

        return $subscription;
    }

    private function sendDigitalAccessSms(Order $order): void
    {
        $order->loadMissing(['buyer', 'product']);
        if (!$order->product || !($order->product->isDigital() || $order->product->isService())) {
            return;
        }

        $phone = $order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone;
        if (!$phone) {
            return;
        }

        $this->smsService->sendDigitalDeliveryNotification(
            $phone,
            (string) $order->product->title,
            url('/orders'),
            $order->buyer_id,
            'digital-delivery:'.($order->public_id ?: $order->id)
        );
    }

    private function handleRetailCreditPayment(Order $paymentOrder, string $gatewayRef, string $gateway): void
    {
        $creditOrderId = (int) data_get($paymentOrder->extra_items, 'credit_order_id');
        if (!$creditOrderId) {
            Log::error("PaymentCallbackProcessor: Credit payment order [{$paymentOrder->id}] missing original order id.");
            return;
        }

        DB::transaction(function () use ($paymentOrder, $creditOrderId, $gatewayRef, $gateway) {
            $creditOrder = Order::query()
                ->whereKey($creditOrderId)
                ->lockForUpdate()
                ->first();

            if (!$creditOrder) {
                Log::error("PaymentCallbackProcessor: Original credit order [{$creditOrderId}] not found.");
                return;
            }

            $payableTotal = (float) ($creditOrder->counter_total ?? $creditOrder->grand_total ?? $creditOrder->total_paid ?? 0);
            $currentPaid = (float) ($creditOrder->total_paid ?? 0);
            $outstanding = max($payableTotal - $currentPaid, 0);
            $amount = min((float) $paymentOrder->total_paid, $outstanding);
            $newPaid = round($currentPaid + $amount, 2);
            $remaining = max($payableTotal - $newPaid, 0);

            if ($amount <= 0) {
                $paymentOrder->update([
                    'payment_status' => 'resolved_merchant_paid',
                    'gateway_ref' => $gatewayRef,
                    'payment_gateway' => $gateway,
                ]);
                Log::warning("PaymentCallbackProcessor: Credit payment order [{$paymentOrder->id}] had no outstanding balance to apply.");
                return;
            }

            $creditOrder->update([
                'total_paid' => $newPaid,
                'payment_status' => $remaining <= 0 ? 'resolved_merchant_paid' : 'pending',
            ]);

            $paymentOrder->update([
                'payment_status' => 'resolved_merchant_paid',
                'gateway_ref' => $gatewayRef,
                'payment_gateway' => $gateway,
            ]);

            $reference = $gatewayRef !== 'N/A' ? $gatewayRef : $paymentOrder->transaction_ref;
            $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($paymentOrder, (float) $amount);

            Transaction::create([
                'user_id' => $paymentOrder->buyer_id,
                'order_id' => $paymentOrder->id,
                'type' => 'order_revenue',
                ...$fee['snapshot'],
                'gross_amount' => $amount,
                'fee_amount' => $fee['fee_amount'],
                'net_amount' => $fee['net_amount'],
                'tax_amount' => $fee['tax_amount'],
                'reference' => $reference,
            ]);

            $wallet = $creditOrder->merchant->user->wallet()->firstOrCreate(
                ['user_id' => $creditOrder->merchant->user_id],
                ['balance' => 0, 'frozen_balance' => 0]
            );
            $wallet->increment('balance', $fee['net_amount']);

            RetailAuditLog::create([
                'merchant_id' => $creditOrder->merchant_id,
                'staff_id' => null,
                'user_id' => $paymentOrder->buyer_id,
                'action' => 'OUTSTANDING_BALANCE_PAYMENT',
                'description' => "Online payment collected for POS {$creditOrder->public_id}.",
                'metadata' => [
                    'order_id' => $creditOrder->id,
                    'public_id' => $creditOrder->public_id,
                    'payment_order_id' => $paymentOrder->id,
                    'amount' => $amount,
                    'remaining_balance' => $remaining,
                    'note' => "Online payment via {$gateway}. Ref: {$gatewayRef}",
                ],
            ]);
        });
    }

    private function isRetailCreditPaymentOrder(Order $order): bool
    {
        return (int) data_get($order->extra_items, 'credit_order_id') > 0;
    }
}
