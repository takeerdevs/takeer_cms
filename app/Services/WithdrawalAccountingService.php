<?php

namespace App\Services;

use App\Models\Transaction;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Str;

class WithdrawalAccountingService
{
    public function recordSubmitted(WithdrawalRequest $withdrawal): void
    {
        $snapshot = $withdrawal->payout_snapshot ?: [];
        $referencePrefix = 'WITHDRAWAL-' . $withdrawal->id . '-';

        if (Transaction::query()
            ->where('merchant_id', $withdrawal->merchant_id)
            ->where('type', 'withdrawal')
            ->where('reference', 'like', $referencePrefix . '%')
            ->exists()) {
            return;
        }

        $requiredSnapshotKeys = [
            'merchant_fee_amount',
            'provider_cost_merchant_amount',
            'takeer_margin_amount',
            'wallet_debit_amount',
            'merchant_principal_amount',
        ];
        $missingSnapshotKeys = array_values(array_filter(
            $requiredSnapshotKeys,
            fn (string $key) => ! array_key_exists($key, $snapshot)
        ));

        if ($missingSnapshotKeys !== []) {
            throw new \RuntimeException('Withdrawal payout snapshot is missing accounting fields: ' . implode(', ', $missingSnapshotKeys));
        }

        $feeSnapshot = is_array($snapshot['fee_policy_snapshot'] ?? null) ? $snapshot['fee_policy_snapshot'] : [];
        $merchantFeeAmount = round(max(0, (float) $snapshot['merchant_fee_amount']), 2);
        $providerCostAmount = round(max(0, (float) $snapshot['provider_cost_merchant_amount']), 2);
        $takeerMarginAmount = round(max(0, (float) $snapshot['takeer_margin_amount']), 2);
        $walletDebitAmount = round(max(0, (float) $snapshot['wallet_debit_amount']), 2);
        $principalAmount = round(max(0, (float) $snapshot['merchant_principal_amount']), 2);

        Transaction::create([
            'user_id' => $withdrawal->user_id,
            'merchant_id' => $withdrawal->merchant_id,
            'order_id' => null,
            'type' => 'withdrawal',
            'fee_policy_id' => $feeSnapshot['fee_policy_id'] ?? null,
            'fee_policy_name' => $feeSnapshot['fee_policy_name'] ?? 'Provider cost + Takeer withdrawal markup',
            'fee_policy_type' => $feeSnapshot['fee_policy_type'] ?? 'fixed',
            'fee_percentage_rate' => $feeSnapshot['fee_percentage_rate'] ?? 0,
            'fee_fixed_amount' => $feeSnapshot['fee_fixed_amount'] ?? $merchantFeeAmount,
            'fee_fixed_currency_code' => $feeSnapshot['fee_fixed_currency_code'] ?? $withdrawal->merchant_currency_code,
            'fee_fixed_amount_converted' => $feeSnapshot['fee_fixed_amount_converted'] ?? $merchantFeeAmount,
            'fee_payment_channel' => $feeSnapshot['fee_payment_channel'] ?? ($snapshot['method'] ?? $withdrawal->method),
            'currency_code' => $withdrawal->merchant_currency_code,
            'gross_amount' => $walletDebitAmount,
            'fee_amount' => $merchantFeeAmount,
            'provider_cost_amount' => $providerCostAmount,
            'takeer_margin_amount' => $takeerMarginAmount,
            'tax_amount' => 0,
            'net_amount' => $principalAmount,
            'reference' => $referencePrefix . Str::random(6),
        ]);
    }
}
