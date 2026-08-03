<?php

namespace App\Console\Commands;

use App\Models\PaymentProvider;
use App\Services\ProviderReconciliationService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;

class ReconcileOrderSettlements extends Command
{
    protected $signature = 'providers:reconcile-order-settlements
        {provider? : Provider key; omit to reconcile every enabled provider}
        {--date= : Business date in YYYY-MM-DD format; defaults to yesterday}
        {--file= : JSON provider export containing reference, amount_minor and currency}
        {--source-type=provider_export : payins, payouts, refunds, or provider_event_journal}
        {--source-reference= : Provider report or statement reference}';

    protected $description = 'Reconcile order-specific payment, payout and refund records to PSP evidence.';

    public function handle(ProviderReconciliationService $reconciliation): int
    {
        $date = Carbon::parse($this->option('date') ?: now()->subDay()->toDateString());
        $providerKey = $this->argument('provider');
        $providers = PaymentProvider::query()
            ->where('status', 'enabled')
            ->when($providerKey, fn ($query) => $query->where('key', $providerKey))
            ->get();

        if ($providers->isEmpty()) {
            $this->error('No enabled payment provider matched the request.');
            return self::FAILURE;
        }

        $records = [];
        $sourceHash = null;
        if ($file = $this->option('file')) {
            if (! File::exists($file)) {
                $this->error('Provider export file was not found.');
                return self::FAILURE;
            }
            $raw = File::get($file);
            $records = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($records)) {
                $this->error('Provider export must contain a JSON array.');
                return self::FAILURE;
            }
            $sourceHash = hash('sha256', $raw);
        }

        foreach ($providers as $provider) {
            $run = $reconciliation->reconcile(
                $provider,
                $date,
                $records,
                (string) $this->option('source-type'),
                $this->option('source-reference'),
                $sourceHash,
            );
            $this->line(sprintf(
                '%s %s: %s; breaks=%d; difference_minor=%d',
                $provider->key,
                $date->toDateString(),
                $run->status,
                $run->breaks->count(),
                (int) $run->difference_amount_minor,
            ));
        }

        return self::SUCCESS;
    }
}
