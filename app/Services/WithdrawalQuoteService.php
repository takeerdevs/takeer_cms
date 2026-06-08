<?php

namespace App\Services;

use App\Models\Merchant;

class WithdrawalQuoteService
{
    public function __construct(
        private readonly CurrencyConversionService $currency,
        private readonly FeePolicyService $fees,
        private readonly MoneyQuoteService $moneyQuotes,
    ) {
    }

    public function quote(Merchant $merchant, float $principalAmount, array $channel): array
    {
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);

        $merchantCurrencyCode = strtoupper((string) ($merchant->currency?->code ?: $this->currency->merchantCurrencyCode((int) $merchant->id)));
        $payoutCurrencyCode = strtoupper((string) ($channel['currency_code'] ?? $merchant->country?->defaultCurrency?->code ?: $merchantCurrencyCode));
        $principalAmount = round(max(0, $principalAmount), 2);

        $moneySnapshot = $this->moneyQuotes->payoutQuote(
            $principalAmount,
            $merchantCurrencyCode,
            $payoutCurrencyCode,
            (int) ($channel['fx_margin_bps'] ?? 0),
        );

        $payoutGrossAmount = round(max(0, (float) ($moneySnapshot['customer_amount'] ?? 0)), 2);
        $providerCostPayout = $this->providerCostForChannel($channel, $payoutGrossAmount);
        $providerCostMerchant = $this->convert($providerCostPayout, $payoutCurrencyCode, $merchantCurrencyCode);
        $policyFee = $this->fees->calculateWithdrawal(
            $merchant,
            $principalAmount,
            $this->feePolicyChannel($channel)
        );
        $markupAmount = round(max(0, (float) $policyFee['fee_amount']), 2);
        $merchantFeeAmount = round($providerCostMerchant + $markupAmount, 2);
        $walletDebitAmount = round($principalAmount + $merchantFeeAmount, 2);
        $marketRate = (float) ($moneySnapshot['fx_market_rate_merchant_to_customer'] ?? $moneySnapshot['fx_rate_merchant_to_customer'] ?? 1);
        $effectiveRate = (float) ($moneySnapshot['fx_effective_rate_merchant_to_customer'] ?? $moneySnapshot['fx_rate_merchant_to_customer'] ?? $marketRate);

        return [
            'merchant_principal_amount' => $principalAmount,
            'merchant_amount' => $principalAmount,
            'wallet_debit_amount' => $walletDebitAmount,
            'merchant_currency_code' => $merchantCurrencyCode,
            'payout_channel_key' => $channel['key'] ?? null,
            'payout_channel_label' => $channel['label'] ?? null,
            'payout_provider' => $channel['provider'] ?? null,
            'payout_method' => strtolower((string) ($channel['method'] ?? 'bank')),
            'payout_currency_code' => $payoutCurrencyCode,
            'payout_gross_amount' => $payoutGrossAmount,
            'payout_amount' => $payoutGrossAmount,
            'provider_cost_amount' => $providerCostPayout,
            'provider_cost_currency_code' => $payoutCurrencyCode,
            'provider_cost_merchant_amount' => $providerCostMerchant,
            'merchant_fee_amount' => $merchantFeeAmount,
            'merchant_fee_currency_code' => $merchantCurrencyCode,
            'withdrawal_fee_amount' => $merchantFeeAmount,
            'withdrawal_fee_currency_code' => $merchantCurrencyCode,
            'takeer_markup_amount' => $markupAmount,
            'takeer_markup_currency_code' => $merchantCurrencyCode,
            'takeer_margin_amount' => $markupAmount,
            'takeer_margin_currency_code' => $merchantCurrencyCode,
            'fee_strategy' => 'provider_cost_plus_markup',
            'market_rate_merchant_to_payout' => round($marketRate, 10),
            'effective_rate_merchant_to_payout' => round($effectiveRate, 10),
            'fx_spread_bps' => (int) ($moneySnapshot['fx_spread_bps'] ?? 0),
            'fx_spread_amount' => (float) ($moneySnapshot['fx_spread_amount'] ?? 0),
            'fx_spread_currency_code' => $payoutCurrencyCode,
            'fx_margin_bps' => (int) ($moneySnapshot['fx_spread_bps'] ?? 0),
            'fx_margin_amount' => (float) ($moneySnapshot['fx_spread_amount'] ?? 0),
            'fee_type' => (string) ($channel['fee_type'] ?? 'fixed_plus_percent'),
            'fee_fixed' => (float) ($channel['fee_fixed'] ?? 0),
            'fee_percent_bps' => (int) ($channel['fee_percent_bps'] ?? 0),
            'fee_min' => (float) ($channel['fee_min'] ?? 0),
            'fee_max' => $channel['fee_max'] ?? null,
            'fx_rate_date' => $moneySnapshot['fx_rate_date'],
            'is_estimate' => true,
            'note' => 'Final payout can change only if the provider rejects or reprices the transaction.',
            'money_snapshot' => $moneySnapshot,
            'fee_policy_snapshot' => $policyFee['snapshot'] ?? [],
            'money_quote_snapshot' => $moneySnapshot['money_quote_snapshot'] ?? null,
        ];
    }

    public function limitError(array $quote, array $channel): ?string
    {
        $limits = is_array($channel['limits'] ?? null) ? $channel['limits'] : [];
        $minimum = $this->positiveLimitAmount($limits['min_withdrawal_amount'] ?? null);
        $maximum = $this->positiveLimitAmount($limits['max_withdrawal_amount'] ?? null);
        $payoutGrossAmount = (float) ($quote['payout_gross_amount'] ?? $quote['payout_amount'] ?? 0);
        $currencyCode = (string) ($quote['payout_currency_code'] ?? $channel['currency_code'] ?? 'TZS');

        if ($minimum !== null && $payoutGrossAmount < $minimum) {
            return 'Kima cha chini cha kutoa kupitia ' . $this->publicPayoutChannelLabel($channel) . ' ni ' . $this->formatMoney($minimum, $currencyCode) . '.';
        }

        if ($maximum !== null && $payoutGrossAmount > $maximum) {
            return 'Kiasi cha juu cha kutoa kupitia ' . $this->publicPayoutChannelLabel($channel) . ' ni ' . $this->formatMoney($maximum, $currencyCode) . '.';
        }

        return null;
    }

    private function providerCostForChannel(array $channel, float $payoutAmount): float
    {
        $feeType = (string) ($channel['fee_type'] ?? 'fixed_plus_percent');
        $fixed = max(0, (float) ($channel['fee_fixed'] ?? 0));
        $percentBps = max(0, min(10000, (int) ($channel['fee_percent_bps'] ?? 0)));

        $fee = match ($feeType) {
            'none' => 0,
            'fixed' => $fixed,
            'percent' => $payoutAmount * ($percentBps / 10000),
            default => $fixed + ($payoutAmount * ($percentBps / 10000)),
        };

        $fee = round(max(0, $fee), 2);
        $min = max(0, (float) ($channel['fee_min'] ?? 0));
        $max = $channel['fee_max'] ?? null;

        if ($fee > 0 && $min > 0) {
            $fee = max($fee, $min);
        }
        if ($max !== null && $max !== '' && (float) $max >= 0) {
            $fee = min($fee, (float) $max);
        }

        return round(max(0, $fee), 2);
    }

    private function convert(float $amount, string $fromCurrencyCode, string $toCurrencyCode): float
    {
        if ($amount <= 0 || $fromCurrencyCode === $toCurrencyCode) {
            return round(max(0, $amount), 2);
        }

        return $this->currency->convert($amount, $fromCurrencyCode, $toCurrencyCode);
    }

    private function feePolicyChannel(array $channel): string
    {
        $channelKey = strtolower((string) ($channel['key'] ?? ''));

        if ($channelKey !== '') {
            return $channelKey;
        }

        $method = strtolower((string) ($channel['method'] ?? 'mobile_money'));

        return match ($method) {
            'bank' => 'bank_payout',
            'paypal' => 'paypal_payout',
            default => 'mobile_money_payout',
        };
    }

    private function positiveLimitAmount(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $amount = (float) $value;

        return $amount > 0 ? $amount : null;
    }

    private function publicPayoutChannelLabel(array $channel): string
    {
        return app(PaymentProviderCatalogService::class)->publicChannelLabel(
            (string) ($channel['method'] ?? 'bank'),
            (string) ($channel['direction'] ?? 'payout')
        );
    }

    private function formatMoney(float $amount, string $currencyCode): string
    {
        $decimals = in_array(strtoupper($currencyCode), ['TZS', 'JPY', 'KRW'], true) ? 0 : 2;

        return strtoupper($currencyCode) . ' ' . number_format($amount, $decimals);
    }
}
