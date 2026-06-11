<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\MerchantPayoutCredential;
use App\Models\Order;
use App\Models\PaymentProviderChannel;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutomaticWithdrawalService
{
    public function createForOrder(Order $order, float $merchantNetAmount, array $withdrawalPolicy): ?WithdrawalRequest
    {
        if (($withdrawalPolicy['mode'] ?? null) !== WithdrawalPolicyService::MODE_AUTOMATIC_WITHDRAWAL || $merchantNetAmount <= 0) {
            return null;
        }

        $merchant = $order->merchant;
        if (! $merchant?->user) {
            return null;
        }

        $credential = $this->defaultCredential($merchant);
        if (! $credential?->channel?->isAvailable()) {
            Log::info('Automatic withdrawal skipped because merchant has no active default payout credential.', [
                'order_id' => $order->id,
                'merchant_id' => $merchant->id,
            ]);

            return null;
        }

        $channel = $this->channelPayload($credential->channel, $credential, $merchant);
        $channel['fx_margin_bps'] = (int) ($channel['fx_margin_bps'] ?? 0);

        $withdrawal = DB::transaction(function () use ($order, $merchant, $credential, $channel, $withdrawalPolicy, $merchantNetAmount) {
            $wallet = $merchant->wallet()->lockForUpdate()->firstOrCreate(
                ['merchant_id' => $merchant->id],
                ['user_id' => $merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
            );

            $walletBalance = round(max(0, (float) $wallet->balance), 2);
            $quote = $this->affordableQuote($merchant, $walletBalance, $channel);
            if (! $quote) {
                Log::info('Automatic withdrawal skipped because wallet balance is not withdrawable yet.', [
                    'order_id' => $order->id,
                    'merchant_id' => $merchant->id,
                    'wallet_balance' => $walletBalance,
                ]);

                return null;
            }

            if ($this->belowMinimumWithdrawalLimit($quote, $channel)) {
                Log::info('Automatic withdrawal skipped because wallet balance is below the payout channel minimum.', [
                    'order_id' => $order->id,
                    'merchant_id' => $merchant->id,
                    'wallet_balance' => $walletBalance,
                    'payout_gross_amount' => (float) ($quote['payout_gross_amount'] ?? 0),
                    'limits' => $channel['limits'] ?? [],
                ]);

                return null;
            }

            if ($limitError = app(WithdrawalQuoteService::class)->limitError($quote, $channel)) {
                Log::info('Automatic withdrawal skipped because payout channel limits are not satisfied.', [
                    'order_id' => $order->id,
                    'merchant_id' => $merchant->id,
                    'wallet_balance' => $walletBalance,
                    'limit_error' => $limitError,
                    'limits' => $channel['limits'] ?? [],
                ]);

                return null;
            }

            $liquidity = app(ProviderTreasuryService::class)->quoteLiquidity($quote, $channel);
            if (! $liquidity['is_available']) {
                Log::warning('Automatic withdrawal skipped because route liquidity is unavailable.', [
                    'order_id' => $order->id,
                    'merchant_id' => $merchant->id,
                    'reason' => $liquidity['reason'] ?? null,
                    'message' => $liquidity['message'] ?? null,
                ]);

                return null;
            }

            $walletDebitAmount = round((float) ($quote['wallet_debit_amount'] ?? 0), 2);
            if ($walletDebitAmount <= 0 || $walletBalance < $walletDebitAmount) {
                Log::warning('Automatic withdrawal skipped because available wallet balance cannot cover the quoted debit.', [
                    'order_id' => $order->id,
                    'merchant_id' => $merchant->id,
                    'wallet_balance' => $walletBalance,
                    'wallet_debit_amount' => $walletDebitAmount,
                ]);

                return null;
            }

            $wallet->balance = round($walletBalance - $walletDebitAmount, 2);
            $wallet->save();

            $withdrawal = WithdrawalRequest::create([
                'user_id' => $merchant->user_id,
                'merchant_id' => $merchant->id,
                'method' => $credential->method,
                'payment_provider_id' => $channel['provider_id'] ?? null,
                'payment_provider_channel_id' => $channel['id'] ?? null,
                'merchant_payout_credential_id' => $credential->id,
                'amount' => $walletDebitAmount,
                'merchant_currency_code' => $quote['merchant_currency_code'],
                'payout_currency_code' => $quote['payout_currency_code'],
                'fx_base_currency_code' => $quote['money_snapshot']['fx_base_currency_code'],
                'fx_rate_merchant_to_base' => $quote['money_snapshot']['fx_rate_merchant_to_base'],
                'fx_rate_payout_to_base' => $quote['money_snapshot']['fx_rate_customer_to_base'],
                'fx_rate_merchant_to_payout' => $quote['effective_rate_merchant_to_payout'],
                'fx_market_rate_merchant_to_payout' => $quote['market_rate_merchant_to_payout'],
                'fx_effective_rate_merchant_to_payout' => $quote['effective_rate_merchant_to_payout'],
                'fx_spread_bps' => $quote['fx_spread_bps'],
                'fx_spread_amount' => $quote['fx_spread_amount'],
                'fx_spread_currency_code' => $quote['fx_spread_currency_code'],
                'fx_rate_date' => $quote['fx_rate_date'],
                'merchant_amount' => $quote['merchant_principal_amount'],
                'payout_amount' => $quote['payout_amount'],
                'payout_snapshot' => $this->snapshot($order, $merchant, $credential, $channel, $quote, $liquidity, $withdrawalPolicy, $walletBalance, $merchantNetAmount),
                'money_quote_snapshot' => $quote['money_quote_snapshot'] ?? null,
                'status' => 'pending',
                'idempotency_key' => 'AUTO-WITHDRAWAL-ORDER-' . $order->id,
            ]);

            $reservation = app(ProviderTreasuryService::class)->reserveForWithdrawal($withdrawal, $quote, $channel);
            $snapshot = $withdrawal->payout_snapshot ?: [];
            $snapshot['treasury_reservation_id'] = $reservation->id;
            $snapshot['treasury_reserved_amount'] = (float) $reservation->amount;
            $snapshot['treasury_reserved_currency_code'] = $reservation->currency_code;
            $withdrawal->update(['payout_snapshot' => $snapshot]);

            return $withdrawal->fresh(['paymentProviderChannel.provider', 'payoutCredential.channel.provider']);
        });

        if ($withdrawal && app(SelcomPayoutService::class)->shouldHandle($withdrawal)) {
            DB::afterCommit(function () use ($withdrawal): void {
                try {
                    app(SelcomPayoutService::class)->submit($withdrawal->fresh());
                } catch (\Throwable $exception) {
                    Log::error('Automatic withdrawal Selcom submission failed.', [
                        'withdrawal_id' => $withdrawal->id,
                        'message' => $exception->getMessage(),
                    ]);
                }
            });
        }

        return $withdrawal;
    }

    private function defaultCredential(Merchant $merchant): ?MerchantPayoutCredential
    {
        return MerchantPayoutCredential::query()
            ->with('channel.provider')
            ->where('merchant_id', $merchant->id)
            ->where('status', 'active')
            ->where('is_default', true)
            ->latest()
            ->first();
    }

    private function affordableQuote(Merchant $merchant, float $walletBalance, array $channel): ?array
    {
        if ($walletBalance <= 0) {
            return null;
        }

        $quoteService = app(WithdrawalQuoteService::class);
        $maximum = $this->positiveLimitAmount($channel['limits']['max_withdrawal_amount'] ?? null);
        $low = 0.0;
        $high = $walletBalance;
        $best = null;

        for ($i = 0; $i < 24; $i++) {
            $mid = round(($low + $high) / 2, 2);
            if ($mid <= 0) {
                break;
            }

            $quote = $quoteService->quote($merchant, $mid, $channel);
            $walletDebitAmount = round((float) ($quote['wallet_debit_amount'] ?? 0), 2);
            $payoutGrossAmount = round((float) ($quote['payout_gross_amount'] ?? $quote['payout_amount'] ?? 0), 2);
            $withinWallet = $walletDebitAmount > 0 && $walletDebitAmount <= $walletBalance;
            $withinMaximum = $maximum === null || $payoutGrossAmount <= $maximum;

            if ($withinWallet && $withinMaximum) {
                $best = $quote;
                $low = $mid + 0.01;
            } else {
                $high = $mid - 0.01;
            }
        }

        if (! $best) {
            return null;
        }

        $principal = round((float) ($best['merchant_principal_amount'] ?? 0), 2);
        if ($principal <= 0) {
            return null;
        }

        return $quoteService->quote($merchant, $principal, $channel);
    }

    private function belowMinimumWithdrawalLimit(array $quote, array $channel): bool
    {
        $minimum = $this->positiveLimitAmount($channel['limits']['min_withdrawal_amount'] ?? null);
        if ($minimum === null) {
            return false;
        }

        return round((float) ($quote['payout_gross_amount'] ?? $quote['payout_amount'] ?? 0), 2) < $minimum;
    }

    private function positiveLimitAmount(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $amount = (float) $value;

        return $amount > 0 ? $amount : null;
    }

    private function channelPayload(PaymentProviderChannel $channel, MerchantPayoutCredential $credential, Merchant $merchant): array
    {
        $payload = app(PaymentProviderCatalogService::class)->channelToArray($channel);
        $payload['label'] = app(PaymentProviderCatalogService::class)->publicChannelLabel($payload['method'], 'payout');
        $payload['currency_code'] = $credential->currency_code ?: ($merchant->currency?->code ?: $payload['currency_code']);

        return $payload;
    }

    private function snapshot(
        Order $order,
        Merchant $merchant,
        MerchantPayoutCredential $credential,
        array $channel,
        array $quote,
        array $liquidity,
        array $withdrawalPolicy,
        float $walletBalanceBeforeWithdrawal,
        float $triggerOrderNetAmount
    ): array {
        return [
            'automatic_withdrawal' => true,
            'order_id' => $order->id,
            'order_public_id' => $order->public_id,
            'trigger_order_net_amount' => round(max(0, $triggerOrderNetAmount), 2),
            'withdrawal_policy' => $withdrawalPolicy,
            'method' => $credential->method,
            'payout_channel_key' => $channel['key'],
            'payout_channel_label' => $channel['label'],
            'payout_provider' => $channel['provider'],
            'payment_provider_id' => $channel['provider_id'] ?? null,
            'payment_provider_channel_id' => $channel['id'] ?? null,
            'merchant_payout_credential_id' => $credential->id,
            'merchant_country_code' => $merchant->country?->iso_alpha2,
            'market_rate_merchant_to_payout' => $quote['market_rate_merchant_to_payout'],
            'effective_rate_merchant_to_payout' => $quote['effective_rate_merchant_to_payout'],
            'merchant_principal_amount' => $quote['merchant_principal_amount'],
            'wallet_debit_amount' => $quote['wallet_debit_amount'],
            'wallet_balance_before_auto_withdrawal' => round($walletBalanceBeforeWithdrawal, 2),
            'payout_gross_amount' => $quote['payout_gross_amount'],
            'payout_amount' => $quote['payout_amount'],
            'fx_spread_bps' => $quote['fx_spread_bps'],
            'fx_spread_amount' => $quote['fx_spread_amount'],
            'fx_spread_currency_code' => $quote['fx_spread_currency_code'],
            'fx_margin_bps' => $quote['fx_margin_bps'],
            'fx_margin_amount' => $quote['fx_margin_amount'],
            'fee_type' => $quote['fee_type'],
            'fee_fixed' => $quote['fee_fixed'],
            'fee_percent_bps' => $quote['fee_percent_bps'],
            'fee_min' => $quote['fee_min'],
            'fee_max' => $quote['fee_max'],
            'provider_cost_amount' => $quote['provider_cost_amount'],
            'provider_cost_currency_code' => $quote['provider_cost_currency_code'],
            'provider_cost_merchant_amount' => $quote['provider_cost_merchant_amount'],
            'merchant_fee_amount' => $quote['merchant_fee_amount'],
            'merchant_fee_currency_code' => $quote['merchant_fee_currency_code'],
            'withdrawal_fee_amount' => $quote['withdrawal_fee_amount'],
            'withdrawal_fee_currency_code' => $quote['withdrawal_fee_currency_code'],
            'takeer_markup_amount' => $quote['takeer_markup_amount'],
            'takeer_markup_currency_code' => $quote['takeer_markup_currency_code'],
            'takeer_margin_amount' => $quote['takeer_margin_amount'],
            'takeer_margin_currency_code' => $quote['takeer_margin_currency_code'],
            'fee_strategy' => $quote['fee_strategy'],
            'fee_policy_snapshot' => $quote['fee_policy_snapshot'],
            'liquidity' => $liquidity,
            'quote_note' => $quote['note'],
            'created_at' => now()->toISOString(),
        ];
    }
}
