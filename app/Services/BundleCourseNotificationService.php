<?php

namespace App\Services;

use App\Models\Bundle;
use App\Models\BundleCohort;
use App\Models\BundleCohortEnrollment;
use App\Models\BundleLiveSession;
use App\Models\Entitlement;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class BundleCourseNotificationService
{
    public function __construct(private readonly PlatformNotificationService $notifications)
    {
    }

    public function notifyCohortEnrollment(BundleCohortEnrollment $enrollment): int
    {
        $enrollment->loadMissing(['user', 'cohort.bundle']);

        $user = $enrollment->user;
        $cohort = $enrollment->cohort;
        $bundle = $cohort?->bundle;

        if (!$user || !$cohort || !$bundle) {
            return 0;
        }

        return $this->dispatchCourseNotice(
            target: $user,
            bundle: $bundle,
            kind: 'bundle_course.cohort_enrolled',
            dedupeKey: "bundle_course.cohort_enrolled:{$cohort->id}:{$user->id}",
            subject: 'Takeer: Umejiunga na darasa',
            message: sprintf(
                'Takeer: Umejiunga na "%s"%s. Fungua masomo yako hapa: %s',
                $bundle->title,
                $cohort->starts_at ? ' linaloanza ' . $this->formatWhen($cohort->starts_at) : '',
                $this->learningUrl($bundle)
            ),
            metadata: [
                'cohort_id' => $cohort->id,
                'enrollment_id' => $enrollment->id,
            ]
        );
    }

    public function logDueReminders(?Carbon $now = null): array
    {
        $now ??= now();

        return [
            'cohort_start' => $this->logCohortStartReminders($now),
            'live_session' => $this->logLiveSessionReminders($now),
        ];
    }

    private function logCohortStartReminders(Carbon $now): int
    {
        $count = 0;

        foreach ($this->reminderWindows($now) as $window => [$from, $to]) {
            BundleCohort::query()
                ->with(['bundle', 'enrollments.user'])
                ->whereIn('status', ['upcoming', 'active'])
                ->whereNotNull('starts_at')
                ->whereBetween('starts_at', [$from, $to])
                ->chunkById(100, function (Collection $cohorts) use (&$count, $window) {
                    foreach ($cohorts as $cohort) {
                        $bundle = $cohort->bundle;
                        if (!$bundle || !$bundle->is_course || $bundle->course_format !== 'cohort') {
                            continue;
                        }

                        foreach ($cohort->enrollments->where('status', 'active') as $enrollment) {
                            if (!$enrollment->user) {
                                continue;
                            }

                            $count += $this->dispatchCourseNotice(
                                target: $enrollment->user,
                                bundle: $bundle,
                                kind: 'bundle_course.cohort_starts_soon',
                                dedupeKey: "bundle_course.cohort_starts_soon:{$cohort->id}:{$enrollment->user_id}:{$window}",
                                subject: 'Takeer: Darasa linaanza karibuni',
                                message: sprintf(
                                    'Takeer: "%s" linaanza %s. Fungua darasa lako: %s',
                                    $bundle->title,
                                    $this->formatWhen($cohort->starts_at),
                                    $this->learningUrl($bundle)
                                ),
                                metadata: [
                                    'cohort_id' => $cohort->id,
                                    'reminder_window' => $window,
                                    'starts_at' => $cohort->starts_at?->toISOString(),
                                ]
                            );
                        }
                    }
                });
        }

        return $count;
    }

    private function logLiveSessionReminders(Carbon $now): int
    {
        $count = 0;

        foreach ($this->reminderWindows($now) as $window => [$from, $to]) {
            BundleLiveSession::query()
                ->with(['lesson.module.bundle'])
                ->whereNotNull('starts_at')
                ->whereBetween('starts_at', [$from, $to])
                ->chunkById(100, function (Collection $sessions) use (&$count, $window) {
                    foreach ($sessions as $session) {
                        $lesson = $session->lesson;
                        $bundle = $lesson?->module?->bundle;

                        if (!$lesson || !$bundle || !$bundle->is_course) {
                            continue;
                        }

                        foreach ($this->courseRecipients($bundle) as $user) {
                            $count += $this->dispatchCourseNotice(
                                target: $user,
                                bundle: $bundle,
                                kind: 'bundle_course.live_session_starts_soon',
                                dedupeKey: "bundle_course.live_session_starts_soon:{$session->id}:{$user->id}:{$window}",
                                subject: 'Takeer: Live class linaanza karibuni',
                                message: sprintf(
                                    'Takeer: "%s" katika "%s" linaanza %s. Fungua darasa: %s',
                                    $lesson->title,
                                    $bundle->title,
                                    $this->formatWhen($session->starts_at),
                                    $this->learningUrl($bundle)
                                ),
                                metadata: [
                                    'lesson_id' => $lesson->id,
                                    'live_session_id' => $session->id,
                                    'reminder_window' => $window,
                                    'starts_at' => $session->starts_at?->toISOString(),
                                ]
                            );
                        }
                    }
                });
        }

        return $count;
    }

    private function courseRecipients(Bundle $bundle): Collection
    {
        if ($bundle->course_format === 'cohort') {
            return User::query()
                ->whereHas('cohortEnrollments', function ($query) use ($bundle) {
                    $query->where('status', 'active')
                        ->whereHas('cohort', fn ($cohortQuery) => $cohortQuery->where('bundle_id', $bundle->id));
                })
                ->get()
                ->unique('id')
                ->values();
        }

        return User::query()
            ->whereIn('id', Entitlement::query()
                ->select('user_id')
                ->where('item_type', 'bundle')
                ->where('item_id', $bundle->id)
                ->where('status', 'active')
                ->where(function ($query) {
                    $query->whereNull('starts_at')->orWhere('starts_at', '<=', now());
                })
                ->where(function ($query) {
                    $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
                }))
            ->get();
    }

    private function dispatchCourseNotice(
        User $target,
        Bundle $bundle,
        string $kind,
        string $dedupeKey,
        string $subject,
        string $message,
        array $metadata = []
    ): int {
        $logs = $this->notifications->dispatchToUser($target, [
            'channels' => ['sms', 'whatsapp', 'email'],
            'subject' => $subject,
            'message' => $message,
            'dedupe_key' => $dedupeKey,
            'metadata' => [
                ...$metadata,
                'kind' => $kind,
                'bundle_id' => $bundle->id,
                'bundle_slug' => $bundle->slug,
                'bundle_title' => $bundle->title,
                'learning_url' => $this->learningUrl($bundle),
            ],
        ]);

        return $logs->count();
    }

    private function reminderWindows(Carbon $now): array
    {
        return [
            '24h' => [$now->copy()->addHours(23), $now->copy()->addHours(25)],
            '1h' => [$now->copy()->addMinutes(45), $now->copy()->addMinutes(75)],
        ];
    }

    private function formatWhen(?Carbon $date): string
    {
        if (!$date) {
            return 'karibuni';
        }

        return $date->timezone(config('app.timezone', 'Africa/Dar_es_Salaam'))->format('d/m/Y H:i');
    }

    private function learningUrl(Bundle $bundle): string
    {
        return rtrim((string) config('app.url'), '/') . '/learn/bundles/' . $bundle->slug;
    }
}
