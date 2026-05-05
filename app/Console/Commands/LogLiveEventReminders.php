<?php

namespace App\Console\Commands;

use App\Services\LiveEventNotificationService;
use Illuminate\Console\Command;

class LogLiveEventReminders extends Command
{
    protected $signature = 'live-events:log-reminders';

    protected $description = 'Prepare standalone live event and webinar reminder notifications in the platform outbox.';

    public function __construct(private readonly LiveEventNotificationService $liveEventNotifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $counts = $this->liveEventNotifications->logDueReminders();
        $total = array_sum($counts);

        $this->info(sprintf(
            'Prepared %d live event reminder notification(s): %d 24h, %d 1h.',
            $total,
            $counts['24h'] ?? 0,
            $counts['1h'] ?? 0
        ));

        return self::SUCCESS;
    }
}
