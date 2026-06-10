<?php

namespace App\Services;

use App\Models\ProviderTreasuryAccount;
use App\Models\ProviderTreasuryReservation;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;

class ProviderTreasuryService
{
    public function quoteLiquidity(array $quote, array $channel): array
    {
        $account = $this->accountForChannel($channel, (string) ($quote['payout_currency_code'] ?? $channel['currency_code'] ?? ''));
        $requiredAmount = $this->requiredAmount($quote);

        if (! $account) {
            return [
                'is_available' => false,
                'reason' => 'missing_treasury_account',
                'message' => 'Payout route liquidity is not configured for this currency.',
                'required_amount' => $requiredAmount,
                'currency_code' => strtoupper((string) ($quote['payout_currency_code'] ?? $channel['currency_code'] ?? '')),
                'available_amount' => 0,
                'account_id' => null,
            ];
        }

        $available = $account->availableAmount();

        return [
            'is_available' => $account->status === 'active' && $available >= $requiredAmount,
            'reason' => $account->status !== 'active'
                ? 'treasury_account_inactive'
                : ($available >= $requiredAmount ? null : 'insufficient_provider_liquidity'),
            'message' => $available >= $requiredAmount
                ? null
                : 'This payout route does not have enough provider liquidity for the selected currency.',
            'required_amount' => $requiredAmount,
            'currency_code' => $account->currency_code,
            'available_amount' => $available,
            'account_id' => $account->id,
            'balance_amount' => (float) $account->balance_amount,
            'reserved_amount' => (float) $account->reserved_amount,
            'minimum_available_amount' => (float) $account->minimum_available_amount,
            'balance_source' => $account->balance_source,
            'last_synced_at' => $account->last_synced_at?->toISOString(),
        ];
    }

    public function reserveForWithdrawal(WithdrawalRequest $withdrawal, array $quote, array $channel): ProviderTreasuryReservation
    {
        return DB::transaction(function () use ($withdrawal, $quote, $channel) {
            $account = $this->accountForChannel($channel, (string) ($quote['payout_currency_code'] ?? $channel['currency_code'] ?? ''));

            if (! $account) {
                throw new \RuntimeException('Payout route liquidity is not configured for this currency.');
            }

            $account = ProviderTreasuryAccount::query()->whereKey($account->id)->lockForUpdate()->firstOrFail();
            $requiredAmount = $this->requiredAmount($quote);

            if ($account->status !== 'active' || $account->availableAmount() < $requiredAmount) {
                throw new \RuntimeException('This payout route does not have enough provider liquidity for the selected currency.');
            }

            $account->increment('reserved_amount', $requiredAmount);

            return ProviderTreasuryReservation::query()->create([
                'provider_treasury_account_id' => $account->id,
                'withdrawal_request_id' => $withdrawal->id,
                'status' => 'reserved',
                'amount' => $requiredAmount,
                'payout_amount' => round((float) ($quote['payout_amount'] ?? 0), 2),
                'provider_cost_amount' => round((float) ($quote['provider_cost_amount'] ?? 0), 2),
                'currency_code' => $account->currency_code,
                'reserved_at' => now(),
                'metadata' => [
                    'payout_channel_key' => $channel['key'] ?? null,
                    'provider' => $channel['provider'] ?? null,
                    'method' => $channel['method'] ?? null,
                    'quote_fx_rate' => $quote['effective_rate_merchant_to_payout'] ?? null,
                ],
            ]);
        });
    }

    public function captureWithdrawal(WithdrawalRequest $withdrawal): void
    {
        $this->settleWithdrawal($withdrawal, 'captured');
    }

    public function releaseWithdrawal(WithdrawalRequest $withdrawal): void
    {
        $this->settleWithdrawal($withdrawal, 'released');
    }

    public function syncAccountBalance(ProviderTreasuryAccount $account, float $balanceAmount, string $source = 'provider', array $metadata = []): ProviderTreasuryAccount
    {
        $account->update([
            'balance_amount' => round(max(0, $balanceAmount), 2),
            'balance_source' => $source,
            'last_synced_at' => now(),
            'metadata' => array_merge($account->metadata ?: [], $metadata),
        ]);

        return $account->fresh();
    }

    private function settleWithdrawal(WithdrawalRequest $withdrawal, string $targetStatus): void
    {
        DB::transaction(function () use ($withdrawal, $targetStatus) {
            $reservation = ProviderTreasuryReservation::query()
                ->where('withdrawal_request_id', $withdrawal->id)
                ->where('status', 'reserved')
                ->lockForUpdate()
                ->first();

            if (! $reservation) {
                return;
            }

            $account = ProviderTreasuryAccount::query()->whereKey($reservation->provider_treasury_account_id)->lockForUpdate()->firstOrFail();
            $amount = (float) $reservation->amount;
            $account->reserved_amount = round(max(0, (float) $account->reserved_amount - $amount), 2);

            if ($targetStatus === 'captured') {
                $account->balance_amount = round(max(0, (float) $account->balance_amount - $amount), 2);
                $reservation->captured_at = now();
            } else {
                $reservation->released_at = now();
            }

            $account->save();
            $reservation->status = $targetStatus;
            $reservation->save();
        });
    }

    private function accountForChannel(array $channel, string $currencyCode): ?ProviderTreasuryAccount
    {
        $currencyCode = strtoupper($currencyCode);
        $channelId = $channel['id'] ?? $channel['payment_provider_channel_id'] ?? null;
        $providerId = $channel['provider_id'] ?? $channel['payment_provider_id'] ?? null;

        if ($channelId) {
            $account = ProviderTreasuryAccount::query()
                ->where('payment_provider_channel_id', $channelId)
                ->where('currency_code', $currencyCode)
                ->first();

            if ($account) {
                return $account;
            }
        }

        if ($providerId) {
            return ProviderTreasuryAccount::query()
                ->where('payment_provider_id', $providerId)
                ->whereNull('payment_provider_channel_id')
                ->where('currency_code', $currencyCode)
                ->first();
        }

        return null;
    }

    private function requiredAmount(array $quote): float
    {
        return round(max(0, (float) ($quote['payout_amount'] ?? 0)) + max(0, (float) ($quote['provider_cost_amount'] ?? 0)), 2);
    }
}
