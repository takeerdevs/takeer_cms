<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Transaction;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WalletService
{
    /**
     * Unlock escrow funds and credit the merchant's wallet.
     * Applies Takeer platform fee, records VAT, and moves balance.
     */
    public function releaseEscrowToMerchant(Order $order): void
    {
        DB::transaction(function () use ($order) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->paid_out_at || $order->payment_status === 'resolved_merchant_paid') {
                return;
            }

            if (!in_array($order->payment_status, ['paid_pending_confirmation', 'awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'disputed'], true)) {
                throw new \Exception('Order is not in a releasable escrow state.');
            }

            $merchant = $order->merchant ?: $order->product?->merchant;
            if (!$merchant?->user) {
                throw new \Exception('Order merchant wallet is not available.');
            }

            $wallet = $merchant->wallet()->lockForUpdate()->firstOrCreate(
                ['merchant_id' => $merchant->id],
                ['user_id' => $merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
            );

            $holdingFeeOrders = Order::query()
                ->where('merchant_id', $merchant->id)
                ->where('payment_status', 'escrow_locked')
                ->whereNull('paid_out_at')
                ->whereIn('extra_items->type', ['pickup_holding_fee', 'pickup_delivery_fee'])
                ->where('extra_items->parent_order_id', $order->id)
                ->lockForUpdate()
                ->get();

            $releaseOrders = collect([$order])->merge($holdingFeeOrders);
            $grossTotal = 0.0;
            $netTotal = 0.0;

            foreach ($releaseOrders as $releaseOrder) {
                $grossAmount = (float) $releaseOrder->total_paid;
                $existingRevenue = Transaction::query()
                    ->where('order_id', $releaseOrder->id)
                    ->where('type', 'order_revenue')
                    ->latest()
                    ->first();

                $isMerchantOnlyPickupFee = data_get($releaseOrder->extra_items, 'type') === 'pickup_holding_fee';
                $fee = $existingRevenue
                    ? null
                    : ($isMerchantOnlyPickupFee
                        ? [
                            'net_amount' => $grossAmount,
                            'fee_amount' => 0,
                            'tax_amount' => 0,
                            'snapshot' => [
                                'fee_policy_name' => 'Merchant late pickup fee',
                                'fee_policy_type' => 'merchant_only',
                                'fee_percentage_rate' => 0,
                                'fee_fixed_amount' => 0,
                                'provider_cost_amount' => 0,
                                'takeer_margin_amount' => 0,
                            ],
                        ]
                        : app(FeePolicyService::class)->calculateForOrder($releaseOrder, $grossAmount));
                $netAmount = $existingRevenue
                    ? (float) $existingRevenue->net_amount
                    : (float) $fee['net_amount'];

                if (! $existingRevenue) {
                    Transaction::create([
                        'user_id' => $merchant->user_id,
                        'merchant_id' => $merchant->id,
                        'order_id' => $releaseOrder->id,
                        'type' => 'order_revenue',
                        ...$fee['snapshot'],
                        'gross_amount' => $grossAmount,
                        'fee_amount' => $fee['fee_amount'],
                        'tax_amount' => $fee['tax_amount'],
                        'net_amount' => $netAmount,
                        'reference' => 'ESCROW-RELEASE-' . $releaseOrder->id . '-' . Str::random(6),
                    ]);
                }

                $grossTotal += $grossAmount;
                $netTotal += $netAmount;

                if ($releaseOrder->id !== $order->id) {
                    $releaseOrder->update([
                        'payment_status' => 'resolved_merchant_paid',
                        'paid_out_at' => now(),
                    ]);
                }
            }

            $wallet->balance += $netTotal;

            // If we tracked frozen balance previously, decrement it
            if ($wallet->frozen_balance >= $grossTotal) {
                $wallet->frozen_balance -= $grossTotal;
            }

            $wallet->save();

            $order->update([
                'payment_status' => 'resolved_merchant_paid',
                'paid_out_at' => now(),
            ]);

            $order->loadMissing(['buyer', 'merchant.user']);
            $publicId = (string) ($order->public_id ?: $order->id);
            $smsService = app(SmsService::class);
            if ($order->buyer?->phone_number) {
                $smsService->sendOrderCompletedToBuyer($order->buyer->phone_number, $publicId, $order->buyer_id);
            }
            if ($merchant->user?->phone_number) {
                $smsService->sendMerchantPayoutReleased($merchant->user->phone_number, $publicId, (float) $netTotal, $merchant->user_id);
            }
        });
    }

    /**
     * Merchant requests a withdrawal of available balance.
     */
    public function requestWithdrawal($merchant, float $amount): WithdrawalRequest
    {
        return DB::transaction(function () use ($merchant, $amount) {
            $wallet = $merchant->wallet()->lockForUpdate()->firstOrCreate(
                ['merchant_id' => $merchant->id],
                ['user_id' => $merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
            );

            if ($wallet->balance < $amount) {
                throw new \Exception('Insufficient wallet balance for this withdrawal.');
            }

            // Deduct immediately to prevent double spending
            $wallet->balance -= $amount;
            $wallet->save();

            return WithdrawalRequest::create([
                'user_id' => $merchant->user_id,
                'merchant_id' => $merchant->id,
                'method' => 'mobile_money',
                'amount' => $amount,
                'status' => 'pending',
            ]);
        });
    }

    /**
     * Admin approves the withdrawal. Triggers M-Pesa B2C and logs transaction.
     */
    public function approveWithdrawal(WithdrawalRequest $request): void
    {
        DB::transaction(function () use ($request) {
            if ($request->status !== 'pending') {
                throw new \Exception('Withdrawal is not pending.');
            }

            // TODO: Here we would call M-Pesa B2C API
            // $b2cResponse = app(MpesaService::class)->b2c($request->user->phone_number, $request->amount);
            // If B2C fails, throw Exception and DB::transaction rolls back.
            $merchant = $request->merchant()->with(['country', 'currency'])->first()
                ?: $request->user->merchantProfiles()->with(['country', 'currency'])->where('is_default', true)->first()
                ?: $request->user->merchantProfiles()->with(['country', 'currency'])->first();
            $fee = $merchant
                ? app(FeePolicyService::class)->calculateWithdrawal($merchant, (float) $request->amount)
                : app(FeePolicyService::class)->calculate('withdrawal', (float) $request->amount);

            Transaction::create([
                'user_id' => $request->user_id,
                'merchant_id' => $request->merchant_id,
                'order_id' => null,
                'type' => 'withdrawal',
                ...$fee['snapshot'],
                'gross_amount' => $request->amount,
                'fee_amount' => $fee['fee_amount'],
                'tax_amount' => $fee['tax_amount'],
                'net_amount' => $fee['net_amount'],
                'reference' => 'WITHDRAWAL-' . $request->id . '-' . Str::random(6),
            ]);

            $request->update(['status' => 'completed']);
        });
    }
}
