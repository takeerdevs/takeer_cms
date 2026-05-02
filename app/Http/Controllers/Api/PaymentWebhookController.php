<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SubscriptionInvoice;
use App\Models\UserSubscription;
use App\Models\Transaction;
use App\Services\EntitlementService;
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

                $order->update([
                    'payment_status' => ($isPhysical || $isHeldService) ? 'escrow_locked' : 'resolved_merchant_paid'
                ]);

                // Log TRA-ready transaction
                $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($order, (float) $order->total_paid);
                Transaction::create([
                    'user_id' => $order->buyer_id,
                    'order_id' => $order->id,
                    'type' => 'order_revenue',
                    ...$fee['snapshot'],
                    'gross_amount' => $order->total_paid,
                    'fee_amount' => $fee['fee_amount'],
                    'net_amount' => $fee['net_amount'],
                    'tax_amount' => $fee['tax_amount'],
                    'reference' => $mpesaReceiptNumber,
                ]);

                if ($isPhysical || $isHeldService) {
                    // Freeze funds in merchant's wallet until delivery/customer confirmation.
                    $wallet = $order->merchant->user->wallet()->firstOrCreate(['user_id' => $order->merchant->user_id], ['balance' => 0, 'frozen_balance' => 0]);
                    $wallet->increment('frozen_balance', $order->total_paid);
                } else {
                    // Instantly release payout for non-physical commerce items.
                    $wallet = $order->merchant->user->wallet()->firstOrCreate(['user_id' => $order->merchant->user_id], ['balance' => 0, 'frozen_balance' => 0]);
                    $wallet->increment('balance', $fee['net_amount']);
                    $this->entitlementService->grantForOrder($order->fresh(['product']));

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
