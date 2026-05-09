<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SubscriptionInvoice;
use App\Models\UserSubscription;
use App\Models\Transaction;
use App\Services\EntitlementService;
use App\Services\OrderExtraItemFulfillmentService;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PaymentWebhookController extends Controller
{
    public function __construct(
        private SmsService $smsService,
        private EntitlementService $entitlementService
    )
    {
    }

    /**
     * POST /api/webhooks/payment/callback
     * Called by M-Pesa when a payment succeeds or fails.
     */
    public function callback(Request $request): JsonResponse
    {
        // 1. Verify webhook signature (Implementation omitted for brevity)
        Log::info('M-Pesa Webhook Received', $request->all());

        $transactionRef = $request->input('TransactionReference'); // e.g. TXN-ABCD
        $status = $request->input('ResultCode'); // 0 = Success
        $mpesaReceiptNumber = $request->input('MpesaReceiptNumber');

        $order = Order::where('transaction_ref', $transactionRef)->first();

        if (!$order || $order->payment_status !== 'pending') {
            return response()->json(['message' => 'Order not found or already processed']);
        }

        if ($status == 0) { // Success
            DB::transaction(function () use ($order, $mpesaReceiptNumber) {
                $serviceRequest = \App\Models\ServiceRequest::query()
                    ->where('payment_order_id', $order->id)
                    ->first();
                $isPhysical = $order->requiresPhysicalFulfillment();
                $isHeldService = (bool) $serviceRequest;
                $isCustomDelivery = $order->product?->isDigital()
                    && ($order->product?->digital_delivery_type ?? null) === 'custom_delivery';

                $childOrders = app(OrderExtraItemFulfillmentService::class)->splitPaidExtras($order->fresh(['product', 'variant', 'delivery', 'merchant']));
                $order->refresh();

                if ($isPhysical && $order->is_inquiry) {
                    $order->markPhysicalAgreement([
                        'total_paid' => (float) $order->total_paid,
                        'notes' => 'Buyer accepted the quoted physical order and gateway confirmed payment.',
                    ]);
                }

                $order->update([
                    'payment_status' => $isPhysical ? 'awaiting_merchant_confirmation' : (($isHeldService || $isCustomDelivery) ? 'escrow_locked' : 'resolved_merchant_paid'),
                    'custom_delivery_due_at' => $isCustomDelivery ? $order->customDeliveryDueAtFrom() : $order->custom_delivery_due_at,
                    'merchant_confirmed_at' => $isPhysical ? now() : $order->merchant_confirmed_at,
                ]);

                $processedOrders = collect([$order->fresh(['product', 'merchant.user'])])
                    ->merge($childOrders->map(fn (Order $child) => $child->fresh(['product', 'merchant.user', 'delivery'])));

                foreach ($processedOrders as $processedOrder) {
                    // Log TRA-ready transaction
                    $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($processedOrder, (float) $processedOrder->total_paid);
                    Transaction::create([
                        'user_id' => $processedOrder->buyer_id,
                        'order_id' => $processedOrder->id,
                        'type' => 'order_revenue',
                        ...$fee['snapshot'],
                        'gross_amount' => $processedOrder->total_paid,
                        'fee_amount' => $fee['fee_amount'],
                        'net_amount' => $fee['net_amount'],
                        'tax_amount' => $fee['tax_amount'],
                        'reference' => $processedOrder->id === $order->id ? $mpesaReceiptNumber : "{$mpesaReceiptNumber}-{$processedOrder->id}",
                    ]);

                    $wallet = $processedOrder->merchant->user->wallet()->firstOrCreate(['user_id' => $processedOrder->merchant->user_id], ['balance' => 0, 'frozen_balance' => 0]);
                    if ($processedOrder->requiresPhysicalFulfillment() || $processedOrder->payment_status === 'escrow_locked') {
                        $wallet->increment('frozen_balance', $processedOrder->total_paid);
                    } else {
                        $wallet->increment('balance', $fee['net_amount']);
                    }

                    if (!$processedOrder->requiresPhysicalFulfillment()) {
                        $this->entitlementService->grantForOrder($processedOrder->fresh(['product']));
                    }
                }

                if ($isPhysical || $isHeldService || $isCustomDelivery) {
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
                    if ($order->purchasable_type === 'subscription_plan') {
                        $subscription = $this->createOrRenewSubscription($order);
                        $this->entitlementService->grantForSubscription($subscription);
                    }
                }

                if ($serviceRequest) {
                    $serviceRequest->update([
                        'payment_status' => 'held',
                        'delivery_status' => 'scheduled',
                        'status' => 'confirmed',
                    ]);
                }
            });

            // Fire event-driven architecture
            if ($order->product) {
                event(new \App\Events\OrderPaid($order));
            }

            if ($order->product?->isPhysical()) {
                // Queue courier assignment logic only for physical items
                \App\Jobs\DispatchCourier::dispatch($order);
            }

        } else { // Failed
            $order->update(['payment_status' => 'failed']);
            \App\Models\ServiceRequest::query()
                ->where('payment_order_id', $order->id)
                ->update(['payment_status' => 'failed']);
            $order->releaseInventory();
        }

        return response()->json(['message' => 'Webhook received']);
    }

    private function createOrRenewSubscription(Order $order): UserSubscription
    {
        $plan = $order->resolved_purchasable;
        $start = now();
        $end = match ($plan->billing_interval) {
            'hourly' => now()->addHours((int) $plan->interval_count),
            'daily' => now()->addDays((int) $plan->interval_count),
            'weekly' => now()->addWeeks((int) $plan->interval_count),
            default => now()->addMonths((int) $plan->interval_count),
        };

        $subscription = UserSubscription::create([
            'user_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'subscription_plan_id' => $plan->id,
            'status' => 'active',
            'auto_renew' => true,
            'started_at' => $start,
            'current_period_start' => $start,
            'current_period_end' => $end,
            'next_billing_at' => $end,
        ]);

        SubscriptionInvoice::create([
            'user_subscription_id' => $subscription->id,
            'order_id' => $order->id,
            'amount' => $order->total_paid,
            'status' => 'paid',
            'billed_for_start' => $start,
            'billed_for_end' => $end,
            'paid_at' => now(),
            'reference' => 'SUB-' . $order->transaction_ref,
        ]);

        return $subscription;
    }
}
