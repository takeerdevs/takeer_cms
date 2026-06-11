<?php

namespace App\Services;

use App\Models\FeePolicy;
use App\Models\Currency;
use App\Models\ExchangeRateHistory;
use App\Models\Merchant;
use App\Models\Order;

class FeePolicyService
{
    public function calculateForOrder(Order $order, float $grossAmount): array
    {
        $merchant = $order->merchant ?: $order->product?->merchant;
        $paymentChannel = $this->paymentChannelForOrder($order);
        $sellableType = $this->sellableTypeForOrder($order);

        $fee = $this->calculate(
            'sale',
            $grossAmount,
            $merchant,
            $order->country_code,
            $merchant?->currency?->code,
            $paymentChannel,
            $sellableType
        );

        return $this->applyProviderCostFloorForOrder($order, $grossAmount, $fee);
    }

    public function calculateWithdrawal(Merchant $merchant, float $amount, ?string $paymentChannel = null): array
    {
        return $this->calculate(
            'withdrawal',
            $amount,
            $merchant,
            $merchant->country?->iso_alpha2,
            $merchant->currency?->code,
            $paymentChannel ?: 'mobile_money_payout'
        );
    }

    public function calculate(
        string $category,
        float $amount,
        ?Merchant $merchant = null,
        ?string $countryCode = null,
        ?string $currencyCode = null,
        ?string $paymentChannel = null,
        ?string $sellableType = null
    ): array {
        $paymentChannel = $paymentChannel ? strtolower($paymentChannel) : null;
        $sellableType = $this->normalizeSellableType($sellableType);
        $currencyCode = $currencyCode ? strtoupper($currencyCode) : 'TZS';
        $policy = $this->resolve($category, $merchant, $countryCode, $currencyCode, $paymentChannel, $sellableType);

        return $this->calculateFromPolicy(
            $policy,
            $amount,
            $currencyCode,
            $paymentChannel,
            $sellableType,
            $category === 'sale' ? 5 : 0,
            $category === 'sale' ? 'percentage' : 'fixed',
            $category === 'sale' ? 'Default 5% Takeer sale fee' : 'Default no withdrawal fee'
        );
    }

    public function calculateWithPolicy(
        FeePolicy $policy,
        float $amount,
        ?string $currencyCode = null,
        ?string $paymentChannel = null
    ): array {
        return $this->calculateFromPolicy(
            $policy,
            $amount,
            $currencyCode ? strtoupper($currencyCode) : 'TZS',
            $paymentChannel ? strtolower($paymentChannel) : null,
            null,
            0,
            'fixed',
            $policy->name
        );
    }

    private function calculateFromPolicy(
        ?FeePolicy $policy,
        float $amount,
        string $currencyCode,
        ?string $paymentChannel,
        ?string $sellableType,
        float $defaultPercentageRate,
        string $defaultFeeType,
        string $defaultPolicyName
    ): array {
        $percentageRate = (float) ($policy?->percentage_rate ?? $defaultPercentageRate);
        $fixedAmount = (float) ($policy?->fixed_amount ?? 0);
        $fixedCurrencyCode = strtoupper((string) ($policy?->fixed_fee_currency_code ?: $currencyCode));
        $convertedFixedAmount = $this->convertFixedAmount($fixedAmount, $fixedCurrencyCode, $currencyCode);
        $feeType = $policy?->fee_type ?? $defaultFeeType;

        $feeAmount = match ($feeType) {
            'fixed' => $convertedFixedAmount,
            'hybrid' => ($amount * ($percentageRate / 100)) + $convertedFixedAmount,
            default => $amount * ($percentageRate / 100),
        };

        if ($policy?->min_fee !== null) {
            $feeAmount = max($feeAmount, (float) $policy->min_fee);
        }

        if ($policy?->max_fee !== null) {
            $feeAmount = min($feeAmount, (float) $policy->max_fee);
        }

        $feeAmount = round(max(0, $feeAmount), 2);
        $taxAmount = round($feeAmount * 0.18, 2);

        return [
            'policy' => $policy,
            'fee_amount' => $feeAmount,
            'tax_amount' => $taxAmount,
            'net_amount' => round(max(0, $amount - $feeAmount), 2),
            'snapshot' => [
                'fee_policy_id' => $policy?->id,
                'fee_policy_name' => $policy?->name ?? $defaultPolicyName,
                'fee_policy_type' => $feeType,
                'fee_percentage_rate' => $percentageRate,
                'fee_fixed_amount' => $fixedAmount,
                'fee_fixed_currency_code' => $fixedCurrencyCode,
                'fee_fixed_amount_converted' => $convertedFixedAmount,
                'fee_payment_channel' => $paymentChannel,
                'fee_sellable_type' => $sellableType,
            ],
        ];
    }

    public function resolve(
        string $category,
        ?Merchant $merchant = null,
        ?string $countryCode = null,
        ?string $currencyCode = null,
        ?string $paymentChannel = null,
        ?string $sellableType = null
    ): ?FeePolicy {
        $now = now();
        $countryCode = $countryCode ? strtoupper($countryCode) : null;
        $currencyCode = $currencyCode ? strtoupper($currencyCode) : null;
        $paymentChannel = $paymentChannel ? strtolower($paymentChannel) : null;
        $sellableType = $this->normalizeSellableType($sellableType);

        $query = FeePolicy::query()
            ->where('category', $category)
            ->where('is_active', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_until')->orWhere('effective_until', '>', $now);
            })
            ->where(function ($q) use ($merchant, $countryCode, $currencyCode, $paymentChannel, $sellableType) {
                $q->where('scope', 'global');

                if ($currencyCode) {
                    $q->orWhere(fn ($sub) => $sub->where('scope', 'currency')->where('currency_code', $currencyCode));
                }

                if ($countryCode) {
                    $q->orWhere(fn ($sub) => $sub->where('scope', 'country')->where('country_code', $countryCode));
                }

                if ($merchant) {
                    $q->orWhere(fn ($sub) => $sub->where('scope', 'merchant')->where('merchant_id', $merchant->id));
                }

                if ($paymentChannel) {
                    $q->orWhere(fn ($sub) => $sub->where('scope', 'payment_channel')->where('payment_channel', $paymentChannel));
                }

                if ($sellableType) {
                    $q->orWhere(fn ($sub) => $sub->where('scope', 'sellable_type')->where('sellable_type', $sellableType));
                }
            });

        return $query
            ->orderByRaw("CASE scope WHEN 'merchant' THEN 1 WHEN 'sellable_type' THEN 2 WHEN 'payment_channel' THEN 3 WHEN 'country' THEN 4 WHEN 'currency' THEN 5 ELSE 6 END")
            ->orderByDesc('effective_from')
            ->latest('id')
            ->first();
    }

    private function sellableTypeForOrder(Order $order): ?string
    {
        return $this->normalizeSellableType($order->product?->type ?: $order->order_kind);
    }

    private function normalizeSellableType(?string $sellableType): ?string
    {
        $sellableType = strtolower(trim((string) $sellableType));

        return in_array($sellableType, ['physical', 'digital', 'service'], true)
            ? $sellableType
            : null;
    }

    private function paymentChannelForOrder(Order $order): ?string
    {
        $snapshot = $order->payment_channel_snapshot ?: [];
        $channelKey = strtolower((string) ($snapshot['payment_provider_channel_key'] ?? ''));

        if ($channelKey !== '') {
            return $channelKey;
        }

        return null;
    }

    private function applyProviderCostFloorForOrder(Order $order, float $grossAmount, array $fee): array
    {
        $providerCost = $this->providerCostForOrder($order);
        $fee['snapshot']['provider_cost_amount'] = $providerCost['merchant_amount'];
        $fee['snapshot']['provider_cost_currency_code'] = $providerCost['merchant_currency_code'];
        $fee['snapshot']['provider_cost_original_amount'] = $providerCost['provider_amount'];
        $fee['snapshot']['provider_cost_original_currency_code'] = $providerCost['provider_currency_code'];
        $fee['snapshot']['provider_cost_floor_applied'] = false;
        $fee['snapshot']['takeer_margin_amount'] = round(max(0, (float) $fee['fee_amount'] - $providerCost['merchant_amount']), 2);

        if ($providerCost['merchant_amount'] <= (float) $fee['fee_amount']) {
            return $fee;
        }

        $feeAmount = round($providerCost['merchant_amount'], 2);
        $taxAmount = round($feeAmount * 0.18, 2);

        $fee['fee_amount'] = $feeAmount;
        $fee['tax_amount'] = $taxAmount;
        $fee['net_amount'] = round(max(0, $grossAmount - $feeAmount), 2);
        $fee['snapshot']['provider_cost_floor_applied'] = true;
        $fee['snapshot']['fee_policy_name'] = trim(($fee['snapshot']['fee_policy_name'] ?? 'Takeer sale fee') . ' (provider cost floor)');
        $fee['snapshot']['takeer_margin_amount'] = 0.0;

        return $fee;
    }

    private function providerCostForOrder(Order $order): array
    {
        $snapshot = $order->payment_channel_snapshot ?: [];
        $feeType = (string) ($snapshot['fee_type'] ?? 'none');
        $customerAmount = (float) ($order->customer_total_amount ?: 0);

        if ($customerAmount <= 0) {
            $rate = (float) ($order->fx_effective_rate_merchant_to_customer ?: $order->fx_rate_merchant_to_customer ?: 1);
            $customerAmount = round((float) ($order->total_paid ?? 0) * max($rate, 0), 2);
        }

        $fixed = max(0, (float) ($snapshot['fee_fixed'] ?? 0));
        $percentBps = max(0, min(10000, (int) ($snapshot['fee_percent_bps'] ?? 0)));
        $providerAmount = match ($feeType) {
            'fixed' => $fixed,
            'percent' => $customerAmount * ($percentBps / 10000),
            'fixed_plus_percent' => $fixed + ($customerAmount * ($percentBps / 10000)),
            default => 0,
        };

        $providerAmount = round(max(0, $providerAmount), 2);
        $min = max(0, (float) ($snapshot['fee_min'] ?? 0));
        $max = $snapshot['fee_max'] ?? null;

        if ($providerAmount > 0 && $min > 0) {
            $providerAmount = max($providerAmount, $min);
        }
        if ($max !== null && $max !== '' && (float) $max >= 0) {
            $providerAmount = min($providerAmount, (float) $max);
        }

        $providerCurrencyCode = strtoupper((string) ($order->customer_currency_code ?: data_get($snapshot, 'currencies.0') ?: $order->merchant_currency_code ?: 'TZS'));
        $merchantCurrencyCode = strtoupper((string) ($order->merchant_currency_code ?: $order->merchant?->currency?->code ?: 'TZS'));
        $rate = (float) ($order->fx_effective_rate_merchant_to_customer ?: $order->fx_rate_merchant_to_customer ?: 1);
        $merchantAmount = $providerCurrencyCode === $merchantCurrencyCode
            ? $providerAmount
            : ($rate > 0 ? round($providerAmount / $rate, 2) : $this->convertFixedAmount($providerAmount, $providerCurrencyCode, $merchantCurrencyCode));

        return [
            'provider_amount' => round($providerAmount, 2),
            'provider_currency_code' => $providerCurrencyCode,
            'merchant_amount' => round(max(0, $merchantAmount), 2),
            'merchant_currency_code' => $merchantCurrencyCode,
        ];
    }

    private function convertFixedAmount(float $amount, string $fromCurrencyCode, string $toCurrencyCode): float
    {
        if ($amount <= 0 || $fromCurrencyCode === $toCurrencyCode) {
            return round(max(0, $amount), 2);
        }

        $fromRate = $this->rateForCurrency($fromCurrencyCode);
        $toRate = $this->rateForCurrency($toCurrencyCode);

        if ($fromRate <= 0 || $toRate <= 0) {
            return round($amount, 2);
        }

        $baseAmount = $amount / $fromRate;

        return round($baseAmount * $toRate, 2);
    }

    private function rateForCurrency(string $currencyCode): float
    {
        $baseCurrencyCode = Currency::query()
            ->where('is_base_currency', true)
            ->value('code') ?: 'USD';

        if ($currencyCode === $baseCurrencyCode) {
            return 1;
        }

        $rate = ExchangeRateHistory::query()
            ->where('base_currency_code', $baseCurrencyCode)
            ->where('currency_code', $currencyCode)
            ->whereDate('effective_date', '<=', now()->toDateString())
            ->latest('effective_date')
            ->value('rate');

        if (! $rate) {
            $rate = Currency::query()
                ->where('code', $currencyCode)
                ->value('exchange_rate');
        }

        return max((float) ($rate ?: 1), 0.0000000001);
    }
}
