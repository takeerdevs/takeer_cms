<?php

namespace App\Console\Commands;

use App\Models\HealthCheckSnapshot;
use App\Support\Health\HealthCheckRunner;
use Illuminate\Console\Command;

class RecordHealthCheck extends Command
{
    protected $signature = 'health:check {--prune-days= : Number of days of health snapshots to keep}';

    protected $description = 'Record a platform readiness snapshot for internal health history.';

    public function handle(HealthCheckRunner $runner): int
    {
        $payload = $runner->run();

        HealthCheckSnapshot::create([
            'status' => $payload['status'],
            'duration_ms' => (int) round($payload['duration_ms']),
            'checks' => $payload['checks'],
            'checked_at' => now(),
        ]);

        $pruneDays = max(1, (int) ($this->option('prune-days') ?: config('health.snapshot_retention_days', 14)));

        HealthCheckSnapshot::query()
            ->where('checked_at', '<', now()->subDays($pruneDays))
            ->delete();

        $this->info(sprintf(
            'Recorded %s health snapshot in %sms.',
            $payload['status'],
            $payload['duration_ms']
        ));

        return $payload['status'] === 'ok' ? self::SUCCESS : self::FAILURE;
    }
}
