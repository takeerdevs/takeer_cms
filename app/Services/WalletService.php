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
            // Ensure order is actually paid and escrow locked
            if (!in_array($order->payment_status, ['paid_pending_confirmation', 'escrow_locked'])) {
                throw new \Exception('Order is not in a releasable escrow state.');
            }

            $merchant = $order->product->merchant;
            $wallet = $merchant->user->wallet()->firstOrCreate(['user_id' => $merchant->user_id]);

            $grossAmount = $order->total_paid;
            $fee = app(FeePolicyService::class)->calculateForOrder($order, (float) $grossAmount);
            $commissionAmount = $fee['fee_amount'];
            $taxAmount = $fee['tax_amount'];
            $netAmount = $fee['net_amount'];

            // 1. Record Merchant Revenue Transaction
            Transaction::create([
                'user_id' => $merchant->user_id,
                'order_id' => $order->id,
                'type' => 'order_revenue',
                ...$fee['snapshot'],
                'gross_amount' => $grossAmount,
                'fee_amount' => $commissionAmount,
                'tax_amount' => $taxAmount,
                'net_amount' => $netAmount,
                'reference' => 'ESCROW-RELEASE-' . $order->id . '-' . Str::random(6),
            ]);

            // 2. Add Net Amount to Merchant Wallet Balance
            $wallet->balance += $netAmount;

            // If we tracked frozen balance previously, decrement it
            if ($wallet->frozen_balance >= $grossAmount) {
                $wallet->frozen_balance -= $grossAmount;
            }

            $wallet->save();

            // 3. Mark Order as Resolved/Paid
            $order->update(['payment_status' => 'resolved_merchant_paid']);
        });
    }

    /**
     * Merchant requests a withdrawal of available balance.
     */
    public function requestWithdrawal($merchant, float $amount): WithdrawalRequest
    {
        return DB::transaction(function () use ($merchant, $amount) {
            $wallet = $merchant->user->wallet()->lockForUpdate()->firstOrCreate(['user_id' => $merchant->user_id]);

            if ($wallet->balance < $amount) {
                throw new \Exception('Insufficient wallet balance for this withdrawal.');
            }

            // Deduct immediately to prevent double spending
            $wallet->balance -= $amount;
            $wallet->save();

            return WithdrawalRequest::create([
                'user_id' => $merchant->user_id,
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
            $merchant = $request->user->merchantProfiles()->with(['country', 'currency'])->where('is_default', true)->first()
                ?: $request->user->merchantProfiles()->with(['country', 'currency'])->first();
            $fee = $merchant
                ? app(FeePolicyService::class)->calculateWithdrawal($merchant, (float) $request->amount)
                : app(FeePolicyService::class)->calculate('withdrawal', (float) $request->amount);

            Transaction::create([
                'user_id' => $request->user_id,
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
