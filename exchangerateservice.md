<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Models\Currency;
use App\Models\ExchangeRateHistory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ExchangeRateService
{
    protected $baseUrl;

    protected $apiKey;

    protected $baseCurrency;

    protected $cacheTtl;

    public function __construct()
    {
        $this->baseUrl = config('services.open_exchange_rates.url', 'https://openexchangerates.org/api/latest.json');
        $this->apiKey = config('services.open_exchange_rates.key');
        $this->baseCurrency = $this->getBaseCurrencyCode();
        $this->cacheTtl = config('services.open_exchange_rates.cache_ttl', 86400); // 24 hours default
    }

    /**
     * Get the base currency code from database
     */
    protected function getBaseCurrencyCode(): string
    {
        // Try to get from cache first
        if (Cache::has('base_currency_code')) {
            return Cache::get('base_currency_code');
        }

        // Fetch from database and cache
        $baseCurrency = Currency::where('is_base_currency', true)->first();
        $code = $baseCurrency ? $baseCurrency->code : 'USD';

        Cache::put('base_currency_code', $code, now()->addDay());

        return $code;
    }

    /**
     * Update exchange rates from API
     */
    public function updateRates(): bool
    {
        try {
            $response = Http::get($this->baseUrl, [
                'app_id' => $this->apiKey,
                'base' => 'USD', // Open Exchange Rates requires a paid plan to change base currency
                'prettyprint' => false,
                'show_alternative' => false,
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $apiBaseCurrency = $data['base']; // Usually USD
                $rates = $data['rates'];

                // If our base currency is not USD and API's base is USD, we need to convert
                if ($this->baseCurrency !== $apiBaseCurrency) {
                    $rates = $this->convertRates($rates, $apiBaseCurrency);
                }

                $this->saveRates($rates);
                $this->trackRatesUpdate('api');



                return true;
            } else {


                return false;
            }
        } catch (\Exception $e) {
            Log::error('Exception while updating exchange rates: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return false;
        }
    }

    /**
     * Convert rates from API base currency to our system's base currency
     */
    protected function convertRates(array $rates, string $apiBase): array
    {
        // Get the conversion rate for our base currency relative to the API's base
        if (!isset($rates[$this->baseCurrency])) {


            return $rates;
        }

        $conversionFactor = $rates[$this->baseCurrency];
        $convertedRates = [];

        // Convert all rates to be relative to our base currency
        foreach ($rates as $code => $rate) {
            $convertedRates[$code] = $rate / $conversionFactor;
        }

        // Our base currency should always be 1
        $convertedRates[$this->baseCurrency] = 1;

        return $convertedRates;
    }

    /**
     * Save rates to the database and log history
     */
    protected function saveRates(array $rates): void
    {
        $today = now()->startOfDay();
        $baseCurrency = Currency::where('is_base_currency', true)->first();

        if (!$baseCurrency) {


            return;
        }

        // Set base currency rate to 1
        $rates[$baseCurrency->code] = 1;

        $currencies = Currency::all()->keyBy('code');
        $updatedCount = 0;
        $historyCount = 0;

        foreach ($rates as $code => $rate) {
            // Skip if we don't have this currency in our system
            if (!isset($currencies[$code])) {
                continue;
            }

            // Update current rate if it's not the base currency (always 1)
            if ($code !== $baseCurrency->code) {
                Currency::where('code', $code)
                    ->update([
                        'exchange_rate' => $rate,
                    ]);
                $updatedCount++;
            }

            // Store historical rate for reporting and analysis
            ExchangeRateHistory::create([
                'currency_code' => $code,
                'rate' => $rate,
                'effective_date' => $today,
            ]);
            $historyCount++;
        }


    }

    /**
     * Track the last update in database (persists across containers)
     */
    protected function trackRatesUpdate(string $source): void
    {
        $timestamp = now()->toIso8601String();

        // Store in database via AdminSetting for persistence across containers
        AdminSetting::setSetting('exchange_rates_last_updated', $timestamp, [
            'group' => 'currency',
            'description' => 'Last exchange rate update timestamp',
        ]);

        AdminSetting::setSetting('exchange_rates_last_source', $source, [
            'group' => 'currency',
            'description' => 'Source of last exchange rate update (api/manual)',
        ]);

        // Also update cache for quick reads within the same container
        Cache::put('exchange_rates_last_updated', $timestamp);
        Cache::put('exchange_rates_last_source', $source);
    }

    /**
     * Manually update a specific currency exchange rate
     */
    public function updateSingleRate(string $code, float $rate): bool
    {
        try {
            $currency = Currency::where('code', $code)->first();

            if (!$currency) {


                return false;
            }

            if ($currency->is_base_currency) {


                return false;
            }

            $currency->exchange_rate = $rate;
            $currency->save();

            // Record in history
            ExchangeRateHistory::create([
                'currency_code' => $code,
                'rate' => $rate,
                'effective_date' => now()->startOfDay(),
                'is_manual' => true,
            ]);

            $this->trackRatesUpdate('manual');



            return true;
        } catch (\Exception $e) {


            return false;
        }
    }

    /**
     * Get info about the last exchange rate update
     */
    public function getLastUpdateInfo(): array
    {
        // Try cache first for quick reads
        $timestamp = Cache::get('exchange_rates_last_updated');
        $source = Cache::get('exchange_rates_last_source');

        // Fall back to database if cache is empty (e.g., different container)
        if (!$timestamp) {
            $timestamp = AdminSetting::getSetting('exchange_rates_last_updated');
            $source = AdminSetting::getSetting('exchange_rates_last_source', 'unknown');

            // Populate cache for next time
            if ($timestamp) {
                Cache::put('exchange_rates_last_updated', $timestamp);
                Cache::put('exchange_rates_last_source', $source);
            }
        }

        return [
            'timestamp' => $timestamp ? Carbon::parse($timestamp) : null,
            'source' => $source ?? 'unknown',
        ];
    }
}
