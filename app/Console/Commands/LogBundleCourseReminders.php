<?php

namespace App\Console\Commands;

use App\Services\BundleCourseNotificationService;
use Illuminate\Console\Command;

class LogBundleCourseReminders extends Command
{
    protected $signature = 'bundle-courses:log-reminders';

    protected $description = 'Prepare course cohort and live-class reminder notifications in the platform outbox.';

    public function __construct(private readonly BundleCourseNotificationService $courseNotifications)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $counts = $this->courseNotifications->logDueReminders();
        $total = array_sum($counts);

        $this->info(sprintf(
            'Prepared %d course reminder notification(s): %d cohort start, %d live session.',
            $total,
            $counts['cohort_start'] ?? 0,
            $counts['live_session'] ?? 0
        ));

        return self::SUCCESS;
    }
}
