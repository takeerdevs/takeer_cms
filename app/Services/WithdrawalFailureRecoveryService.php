<?php

namespace App\Services;

use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;

class WithdrawalFailureRecoveryService
{
    public function refundWalletDebit(WithdrawalRequest $withdrawal): void
    {
        DB::transaction(function () use ($withdrawal) {
            $withdrawal = WithdrawalRequest::query()
                ->with('merchant')
                ->whereKey($withdrawal->id)
                ->lockForUpdate()
                ->firstOrFail();

            $snapshot = $withdrawal->payout_snapshot ?: [];
            if (! empty($snapshot['wallet_refunded_at'])) {
                return;
            }

            $wallet = $withdrawal->merchant?->wallet()->lockForUpdate()->first();
            if (! $wallet) {
                return;
            }

            $refundAmount = round((float) ($snapshot['wallet_debit_amount'] ?? $withdrawal->amount ?? 0), 2);
            if ($refundAmount <= 0) {
                return;
            }

            $wallet->balance = round((float) $wallet->balance + $refundAmount, 2);
            $wallet->save();

            $snapshot['wallet_refunded_at'] = now()->toISOString();
            $snapshot['wallet_refund_amount'] = $refundAmount;
            $snapshot['wallet_refund_currency_code'] = $withdrawal->merchant_currency_code;
            $withdrawal->update(['payout_snapshot' => $snapshot]);
        });
    }
}
