<?php

namespace App\Console\Commands;

use App\Services\ExchangeRateService;
use Illuminate\Console\Command;

class UpdateExchangeRates extends Command
{
    protected $signature = 'currency:update-rates
        {--currency= : Manually update one currency code, e.g. KES}
        {--rate= : Manual rate, local currency units per 1 base currency unit}
        {--source=manual : Source label for manual updates}';

    protected $description = 'Refresh exchange rates from the configured provider or manually update one currency.';

    public function handle(ExchangeRateService $exchangeRates): int
    {
        $currency = $this->option('currency');
        $rate = $this->option('rate');

        if ($currency || $rate) {
            if (! $currency || ! $rate) {
                $this->error('Both --currency and --rate are required for a manual update.');

                return self::FAILURE;
            }

            $updated = $exchangeRates->updateSingleRate(
                strtoupper((string) $currency),
                (float) $rate,
                (string) $this->option('source')
            );

            if (! $updated) {
                $this->error('Manual exchange rate update failed.');

                return self::FAILURE;
            }

            $this->info("Updated {$currency} exchange rate.");

            return self::SUCCESS;
        }

        if (! $exchangeRates->updateRates()) {
            $this->error('Exchange rate update failed. Check logs and OPEN_EXCHANGE_RATES_KEY.');

            return self::FAILURE;
        }

        $this->info('Exchange rates updated successfully.');

        return self::SUCCESS;
    }
}
