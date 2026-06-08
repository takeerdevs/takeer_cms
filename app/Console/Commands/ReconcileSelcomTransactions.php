<?php

namespace App\Console\Commands;

use App\Services\SelcomReconciliationService;
use Illuminate\Console\Command;

class ReconcileSelcomTransactions extends Command
{
    protected $signature = 'payments:reconcile-selcom {--limit=50 : Maximum pending records to check per direction}';

    protected $description = 'Poll Selcom for pending checkout payments and processing payouts.';

    public function handle(SelcomReconciliationService $reconciliation): int
    {
        $summary = $reconciliation->reconcile((int) $this->option('limit'));

        $this->info('Selcom reconciliation complete.');
        $this->line('Orders: ' . json_encode($summary['orders']));
        $this->line('Withdrawals: ' . json_encode($summary['withdrawals']));

        return Command::SUCCESS;
    }
}
