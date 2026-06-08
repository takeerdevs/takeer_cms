<?php

namespace App\Services;

use App\Models\Country;
use App\Models\Currency;
use App\Models\ExchangeRateHistory;
use App\Models\Merchant;

class CurrencyConversionService
{
    public function checkoutSnapshot(float $merchantAmount, int $merchantId, ?string $countryCode = null): array
    {
        $merchantCurrencyCode = $this->merchantCurrencyCode($merchantId);
        $customerCurrencyCode = $this->customerCurrencyCode($countryCode) ?: $merchantCurrencyCode;

        return $this->snapshot($merchantAmount, $merchantCurrencyCode, $customerCurrencyCode);
    }

    public function snapshot(float $amount, string $fromCurrencyCode, string $toCurrencyCode): array
    {
        $fromCurrencyCode = strtoupper($fromCurrencyCode);
        $toCurrencyCode = strtoupper($toCurrencyCode);
        $baseCurrencyCode = $this->baseCurrencyCode();
        $fromRate = $this->rateForCurrency($fromCurrencyCode, $baseCurrencyCode);
        $toRate = $this->rateForCurrency($toCurrencyCode, $baseCurrencyCode);
        $rate = $fromRate > 0 ? $toRate / $fromRate : 1;

        return [
            'merchant_currency_code' => $fromCurrencyCode,
            'customer_currency_code' => $toCurrencyCode,
            'fx_base_currency_code' => $baseCurrencyCode,
            'fx_rate_merchant_to_base' => $fromRate,
            'fx_rate_customer_to_base' => $toRate,
            'fx_rate_merchant_to_customer' => $rate,
            'fx_rate_date' => now()->toDateString(),
            'merchant_amount' => round($amount, 2),
            'customer_amount' => round($amount * $rate, 2),
        ];
    }

    public function convert(float $amount, string $fromCurrencyCode, string $toCurrencyCode): float
    {
        return (float) $this->snapshot($amount, $fromCurrencyCode, $toCurrencyCode)['customer_amount'];
    }

    public function merchantCurrencyCode(int $merchantId): string
    {
        return Merchant::query()
            ->with('currency:id,code')
            ->find($merchantId)
            ?->currency
            ?->code ?: 'TZS';
    }

    public function customerCurrencyCode(?string $countryCode): ?string
    {
        if (! $countryCode) {
            return null;
        }

        return Country::query()
            ->where('iso_alpha2', strtoupper($countryCode))
            ->with('defaultCurrency:id,code')
            ->first()
            ?->defaultCurrency
            ?->code;
    }

    private function baseCurrencyCode(): string
    {
        return Currency::query()
            ->where('is_base_currency', true)
            ->value('code') ?: 'USD';
    }

    private function rateForCurrency(string $currencyCode, string $baseCurrencyCode): float
    {
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
