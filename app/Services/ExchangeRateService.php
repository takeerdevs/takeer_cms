<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\Currency;
use App\Models\ExchangeRateHistory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class ExchangeRateService
{
    private string $baseUrl;
    private ?string $apiKey;
    private string $baseCurrencyCode;
    private int $cacheTtl;

    public function __construct()
    {
        $this->baseUrl = config('services.open_exchange_rates.url', 'https://openexchangerates.org/api/latest.json');
        $this->apiKey = config('services.open_exchange_rates.key');
        $this->baseCurrencyCode = $this->resolveBaseCurrencyCode();
        $this->cacheTtl = (int) config('services.open_exchange_rates.cache_ttl', 86400);
    }

    public function updateRates(): bool
    {
        if (! $this->apiKey) {
            Log::warning('Exchange rate update skipped: OPEN_EXCHANGE_RATES_KEY is not configured.');

            return false;
        }

        try {
            $response = Http::timeout(20)->get($this->baseUrl, [
                'app_id' => $this->apiKey,
                'base' => 'USD',
                'prettyprint' => false,
                'show_alternative' => false,
            ]);

            if (! $response->successful()) {
                Log::warning('Exchange rate update failed.', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return false;
            }

            $payload = $response->json();
            $apiBaseCurrencyCode = (string) ($payload['base'] ?? 'USD');
            $rates = $payload['rates'] ?? [];

            if (! is_array($rates) || $rates === []) {
                Log::warning('Exchange rate update failed: API returned no rates.');

                return false;
            }

            if ($this->baseCurrencyCode !== $apiBaseCurrencyCode) {
                $rates = $this->convertRatesToBase($rates);
            }

            $this->saveRates($rates, 'api');
            $this->trackRatesUpdate('api');

            return true;
        } catch (Throwable $e) {
            Log::error('Exchange rate update crashed.', [
                'message' => $e->getMessage(),
                'exception' => $e::class,
            ]);

            return false;
        }
    }

    public function updateSingleRate(string $code, float $rate, string $source = 'manual'): bool
    {
        $code = strtoupper($code);

        if ($rate <= 0) {
            return false;
        }

        $currency = Currency::query()->where('code', $code)->first();

        if (! $currency || $currency->is_base_currency) {
            return false;
        }

        $currency->update(['exchange_rate' => $rate]);

        ExchangeRateHistory::query()->updateOrCreate(
            [
                'base_currency_code' => $this->baseCurrencyCode,
                'currency_code' => $code,
                'effective_date' => now()->toDateString(),
            ],
            [
                'rate' => $rate,
                'is_manual' => true,
                'source' => $source,
            ]
        );

        $this->trackRatesUpdate($source);

        return true;
    }

    public function getLastUpdateInfo(): array
    {
        $timestamp = Cache::get('exchange_rates_last_updated')
            ?: AdminSetting::get('exchange_rates_last_updated');
        $source = Cache::get('exchange_rates_last_source')
            ?: AdminSetting::get('exchange_rates_last_source', 'unknown');

        return [
            'timestamp' => $timestamp,
            'source' => $source,
        ];
    }

    private function resolveBaseCurrencyCode(): string
    {
        return Cache::remember('base_currency_code', now()->addDay(), function (): string {
            return Currency::query()
                ->where('is_base_currency', true)
                ->value('code') ?: 'USD';
        });
    }

    private function convertRatesToBase(array $rates): array
    {
        if (! isset($rates[$this->baseCurrencyCode]) || (float) $rates[$this->baseCurrencyCode] <= 0) {
            return $rates;
        }

        $conversionFactor = (float) $rates[$this->baseCurrencyCode];
        $convertedRates = [];

        foreach ($rates as $code => $rate) {
            $convertedRates[$code] = (float) $rate / $conversionFactor;
        }

        $convertedRates[$this->baseCurrencyCode] = 1;

        return $convertedRates;
    }

    private function saveRates(array $rates, string $source): void
    {
        $baseCurrency = Currency::query()->where('is_base_currency', true)->first();

        if (! $baseCurrency) {
            return;
        }

        $rates[$baseCurrency->code] = 1;
        $currencies = Currency::query()->get()->keyBy('code');

        foreach ($rates as $code => $rate) {
            $code = strtoupper((string) $code);

            if (! $currencies->has($code)) {
                continue;
            }

            $rate = (float) $rate;

            if ($rate <= 0) {
                continue;
            }

            Currency::query()
                ->where('code', $code)
                ->update(['exchange_rate' => $rate]);

            ExchangeRateHistory::query()->updateOrCreate(
                [
                    'base_currency_code' => $baseCurrency->code,
                    'currency_code' => $code,
                    'effective_date' => now()->toDateString(),
                ],
                [
                    'rate' => $rate,
                    'is_manual' => false,
                    'source' => $source,
                ]
            );
        }
    }

    private function trackRatesUpdate(string $source): void
    {
        $timestamp = now()->toIso8601String();

        AdminSetting::query()->updateOrCreate(
            ['key' => 'exchange_rates_last_updated'],
            [
                'value' => $timestamp,
                'description' => 'Last exchange rate update timestamp',
            ]
        );
        AdminSetting::query()->updateOrCreate(
            ['key' => 'exchange_rates_last_source'],
            [
                'value' => $source,
                'description' => 'Source of last exchange rate update',
            ]
        );

        Cache::put('exchange_rates_last_updated', $timestamp, $this->cacheTtl);
        Cache::put('exchange_rates_last_source', $source, $this->cacheTtl);
    }
}
