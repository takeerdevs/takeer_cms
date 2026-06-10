<?php

namespace App\Console\Commands;

use App\Models\ProviderTreasuryAccount;
use App\Services\SelcomPayoutService;
use Illuminate\Console\Command;

class SyncSelcomTreasuryBalance extends Command
{
    protected $signature = 'selcom:sync-treasury-balance {--account-id= : Sync only one provider treasury account id}';

    protected $description = 'Sync Selcom vendor float balance into provider treasury accounts.';

    public function handle(SelcomPayoutService $selcom): int
    {
        $query = ProviderTreasuryAccount::query()->where('provider_key', 'selcom');

        if ($this->option('account-id')) {
            $query->whereKey((int) $this->option('account-id'));
        }

        $accounts = $query->get();

        if ($accounts->isEmpty()) {
            $this->warn('No Selcom provider treasury accounts are configured.');
            return self::SUCCESS;
        }

        foreach ($accounts as $account) {
            $result = $selcom->syncTreasuryAccount($account);

            if (! $result->success) {
                $this->error("Account {$account->id}: {$result->message}");
                continue;
            }

            $account->refresh();
            $this->info("Account {$account->id}: {$account->currency_code} balance {$account->balance_amount}, reserved {$account->reserved_amount}.");
        }

        return self::SUCCESS;
    }
}
