<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\PaymentProviderChannel;

class MoneyQuoteService
{
    public function __construct(
        private readonly CurrencyConversionService $converter,
        private readonly PaymentChannelRouter $router,
    ) {}

    public function checkoutQuote(float $merchantAmount, int $merchantId, ?string $countryCode = null): array
    {
        $merchant = Merchant::query()
            ->with(['currency:id,code', 'country.defaultCurrency:id,code'])
            ->find($merchantId);

        $merchantCurrencyCode = $merchant?->currency?->code ?: $this->converter->merchantCurrencyCode($merchantId);
        $customerCurrencyCode = $this->converter->customerCurrencyCode($countryCode) ?: $merchantCurrencyCode;
        $channel = $merchant
            ? $this->router->resolvePayinChannel($merchant, $countryCode, null, $customerCurrencyCode)
            : null;

        return $this->quote(
            amount: $merchantAmount,
            fromCurrencyCode: $merchantCurrencyCode,
            toCurrencyCode: $customerCurrencyCode,
            direction: 'payin',
            spreadBps: $channel ? (int) $channel->fx_margin_bps : 0,
            channel: $channel,
        );
    }

    public function payoutQuote(float $merchantAmount, string $merchantCurrencyCode, string $payoutCurrencyCode, int $spreadBps = 0, ?PaymentProviderChannel $channel = null): array
    {
        return $this->quote(
            amount: $merchantAmount,
            fromCurrencyCode: $merchantCurrencyCode,
            toCurrencyCode: $payoutCurrencyCode,
            direction: 'payout',
            spreadBps: $spreadBps,
            channel: $channel,
        );
    }

    public function quote(
        float $amount,
        string $fromCurrencyCode,
        string $toCurrencyCode,
        string $direction,
        int $spreadBps = 0,
        ?PaymentProviderChannel $channel = null,
    ): array {
        $direction = strtolower($direction) === 'payout' ? 'payout' : 'payin';
        $market = $this->converter->snapshot($amount, $fromCurrencyCode, $toCurrencyCode);
        $fromCurrencyCode = $market['merchant_currency_code'];
        $toCurrencyCode = $market['customer_currency_code'];
        $sameCurrency = $fromCurrencyCode === $toCurrencyCode;
        $spreadBps = $sameCurrency ? 0 : max(0, min(5000, $spreadBps));
        $marketRate = (float) $market['fx_rate_merchant_to_customer'];
        $spreadFactor = $spreadBps / 10000;
        $effectiveRate = $direction === 'payout'
            ? $marketRate * (1 - $spreadFactor)
            : $marketRate * (1 + $spreadFactor);
        $effectiveRate = max($effectiveRate, 0);
        $marketAmount = (float) $market['customer_amount'];
        $effectiveAmount = round($amount * $effectiveRate, 2);
        $spreadAmount = round(abs($effectiveAmount - $marketAmount), 2);

        return array_merge($market, [
            'direction' => $direction,
            'merchant_amount' => round($amount, 2),
            'customer_amount' => $effectiveAmount,
            'market_customer_amount' => $marketAmount,
            'effective_customer_amount' => $effectiveAmount,
            'fx_market_rate_merchant_to_customer' => round($marketRate, 10),
            'fx_effective_rate_merchant_to_customer' => round($effectiveRate, 10),
            'fx_rate_merchant_to_customer' => round($effectiveRate, 10),
            'fx_spread_bps' => $spreadBps,
            'fx_spread_amount' => $spreadAmount,
            'fx_spread_currency_code' => $toCurrencyCode,
            'is_same_currency' => $sameCurrency,
            'payment_provider_id' => $channel?->payment_provider_id,
            'payment_provider_channel_id' => $channel?->id,
            'payment_channel_snapshot' => $channel ? $this->router->channelSnapshot($channel) : null,
            'money_quote_snapshot' => [
                'direction' => $direction,
                'from_currency_code' => $fromCurrencyCode,
                'to_currency_code' => $toCurrencyCode,
                'base_currency_code' => $market['fx_base_currency_code'],
                'market_rate' => round($marketRate, 10),
                'effective_rate' => round($effectiveRate, 10),
                'rate_to_base_from' => $market['fx_rate_merchant_to_base'],
                'rate_to_base_to' => $market['fx_rate_customer_to_base'],
                'input_amount' => round($amount, 2),
                'market_amount' => $marketAmount,
                'effective_amount' => $effectiveAmount,
                'fx_spread_bps' => $spreadBps,
                'fx_spread_amount' => $spreadAmount,
                'fx_spread_currency_code' => $toCurrencyCode,
                'fx_rate_date' => $market['fx_rate_date'],
                'payment_provider_id' => $channel?->payment_provider_id,
                'payment_provider_channel_id' => $channel?->id,
                'payment_provider_channel_key' => $channel?->key,
            ],
        ]);
    }

    public function amountFromQuote(array $quote, float $amount): array
    {
        $marketRate = (float) ($quote['fx_market_rate_merchant_to_customer'] ?? $quote['fx_rate_merchant_to_customer'] ?? 1);
        $effectiveRate = (float) ($quote['fx_effective_rate_merchant_to_customer'] ?? $quote['fx_rate_merchant_to_customer'] ?? $marketRate);
        $marketAmount = round($amount * $marketRate, 2);
        $effectiveAmount = round($amount * $effectiveRate, 2);

        return [
            'merchant_currency_code' => $quote['merchant_currency_code'],
            'customer_currency_code' => $quote['customer_currency_code'],
            'fx_base_currency_code' => $quote['fx_base_currency_code'],
            'fx_rate_merchant_to_base' => $quote['fx_rate_merchant_to_base'],
            'fx_rate_customer_to_base' => $quote['fx_rate_customer_to_base'],
            'fx_rate_merchant_to_customer' => $effectiveRate,
            'fx_market_rate_merchant_to_customer' => $marketRate,
            'fx_effective_rate_merchant_to_customer' => $effectiveRate,
            'fx_rate_date' => $quote['fx_rate_date'],
            'merchant_amount' => round($amount, 2),
            'customer_amount' => $effectiveAmount,
            'market_customer_amount' => $marketAmount,
            'fx_spread_amount' => round(abs($effectiveAmount - $marketAmount), 2),
            'fx_spread_currency_code' => $quote['customer_currency_code'],
        ];
    }
}
