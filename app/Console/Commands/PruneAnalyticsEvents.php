<?php

namespace App\Console\Commands;

use App\Models\AdminSetting;
use App\Models\MarketingEvent;
use Illuminate\Console\Command;

class PruneAnalyticsEvents extends Command
{
    protected $signature = 'analytics:prune {--days= : Override analytics retention days} {--chunk=1000 : Rows to delete per batch} {--dry-run : Count rows without deleting}';

    protected $description = 'Delete analytics events older than the configured retention period.';

    public function handle(): int
    {
        $days = $this->option('days') !== null
            ? (int) $this->option('days')
            : (int) AdminSetting::get('analytics_retention_days', '365');
        $days = max(30, min(1095, $days));
        $chunk = max(100, min(10000, (int) $this->option('chunk')));
        $cutoff = now()->subDays($days);

        $query = MarketingEvent::query()->where('created_at', '<', $cutoff);
        $total = (clone $query)->count();

        if ($this->option('dry-run')) {
            $this->info("Analytics prune dry run: {$total} events older than {$days} days would be deleted.");
            return self::SUCCESS;
        }

        $deleted = 0;
        do {
            $ids = (clone $query)->limit($chunk)->pluck('id');
            if ($ids->isEmpty()) {
                break;
            }

            $deleted += MarketingEvent::query()->whereIn('id', $ids)->delete();
        } while ($ids->count() === $chunk);

        $this->info("Analytics prune complete: {$deleted} events deleted. Retention: {$days} days.");

        return self::SUCCESS;
    }
}
