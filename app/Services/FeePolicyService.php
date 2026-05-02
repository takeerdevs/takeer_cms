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

        return $this->calculate(
            'sale',
            $grossAmount,
            $merchant,
            $order->country_code,
            $merchant?->currency?->code,
            $paymentChannel
        );
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
        ?string $paymentChannel = null
    ): array {
        $paymentChannel = $paymentChannel ? strtolower($paymentChannel) : null;
        $currencyCode = $currencyCode ? strtoupper($currencyCode) : 'TZS';
        $policy = $this->resolve($category, $merchant, $countryCode, $currencyCode, $paymentChannel);

        return $this->calculateFromPolicy(
            $policy,
            $amount,
            $currencyCode,
            $paymentChannel,
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
            ],
        ];
    }

    public function resolve(
        string $category,
        ?Merchant $merchant = null,
        ?string $countryCode = null,
        ?string $currencyCode = null,
        ?string $paymentChannel = null
    ): ?FeePolicy {
        $now = now();
        $countryCode = $countryCode ? strtoupper($countryCode) : null;
        $currencyCode = $currencyCode ? strtoupper($currencyCode) : null;
        $paymentChannel = $paymentChannel ? strtolower($paymentChannel) : null;

        $query = FeePolicy::query()
            ->where('category', $category)
            ->where('is_active', true)
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_from')->orWhere('effective_from', '<=', $now);
            })
            ->where(function ($q) use ($now) {
                $q->whereNull('effective_until')->orWhere('effective_until', '>', $now);
            })
            ->where(function ($q) use ($merchant, $countryCode, $currencyCode, $paymentChannel) {
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
            });

        return $query
            ->orderByRaw("CASE scope WHEN 'merchant' THEN 1 WHEN 'payment_channel' THEN 2 WHEN 'country' THEN 3 WHEN 'currency' THEN 4 ELSE 5 END")
            ->orderByDesc('effective_from')
            ->latest('id')
            ->first();
    }

    private function paymentChannelForOrder(Order $order): ?string
    {
        if ($order->payment_gateway) {
            return strtolower($order->payment_gateway);
        }

        return match ($order->payment_mode) {
            'cash' => 'cash',
            'merchant_mm' => 'merchant_mobile_money',
            'online_escrow' => 'online_escrow',
            'store_credit' => 'store_credit',
            default => null,
        };
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
