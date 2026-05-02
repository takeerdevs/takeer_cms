<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\BundleCohortEnrollment;
use App\Models\BundleCourseProgress;
use App\Models\BundleLiveSession;
use App\Models\BundleLiveSessionAttendance;
use App\Models\Entitlement;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class MerchantCourseController extends Controller
{
    public function dashboard(Request $request, Merchant $merchant, Bundle $bundle): JsonResponse
    {
        $this->ensureOwnership($request, $merchant, $bundle);

        $bundle->load([
            'courseModules.lessons.liveSession.attendances.user',
            'cohorts.enrollments.user',
            'cohorts.enrollments.order',
        ]);

        abort_unless($bundle->is_course, 404, 'Course not found.');

        $lessonIds = $bundle->courseModules->flatMap->lessons->pluck('id')->values();
        $students = $this->studentsForBundle($bundle);
        $progressCounts = BundleCourseProgress::query()
            ->whereIn('bundle_course_lesson_id', $lessonIds)
            ->whereIn('user_id', $students->pluck('id'))
            ->selectRaw('user_id, count(*) as completed_count, max(completed_at) as last_completed_at')
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        $cohortByUser = $bundle->cohorts
            ->flatMap(fn ($cohort) => $cohort->enrollments->map(fn ($enrollment) => [
                'user_id' => $enrollment->user_id,
                'cohort' => $cohort,
                'enrollment' => $enrollment,
            ]))
            ->keyBy('user_id');

        $sessions = $bundle->courseModules
            ->flatMap->lessons
            ->filter(fn ($lesson) => $lesson->liveSession)
            ->map(function ($lesson) {
                $session = $lesson->liveSession;

                return [
                    'id' => $session->id,
                    'lesson_id' => $lesson->id,
                    'lesson_title' => $lesson->title,
                    'starts_at' => $session->starts_at?->toISOString(),
                    'duration_minutes' => $session->duration_minutes,
                    'timezone' => $session->timezone,
                    'meeting_url' => $session->meeting_url,
                    'venue' => $session->venue,
                    'capacity' => $session->capacity,
                    'check_in_enabled' => (bool) $session->check_in_enabled,
                    'check_in_code' => $session->check_in_code,
                    'check_in_code_expires_at' => $session->check_in_code_expires_at?->toISOString(),
                    'attendances' => $session->attendances->map(fn ($attendance) => [
                        'id' => $attendance->id,
                        'user_id' => $attendance->user_id,
                        'student_name' => $attendance->user?->name,
                        'status' => $attendance->status,
                        'method' => $attendance->method,
                        'checked_in_at' => $attendance->checked_in_at?->toISOString(),
                    ])->values(),
                ];
            })
            ->sortBy('starts_at')
            ->values();

        return response()->json([
            'bundle' => [
                'id' => $bundle->id,
                'title' => $bundle->title,
                'slug' => $bundle->slug,
                'course_format' => $bundle->course_format,
                'status' => $bundle->status,
                'lesson_count' => $lessonIds->count(),
            ],
            'students' => $students->map(function (User $student) use ($progressCounts, $lessonIds, $cohortByUser) {
                $progress = $progressCounts->get($student->id);
                $cohortEntry = $cohortByUser->get($student->id);

                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'phone_number' => $student->phone_number,
                    'completed_lessons' => (int) ($progress?->completed_count ?? 0),
                    'total_lessons' => $lessonIds->count(),
                    'last_completed_at' => $progress?->last_completed_at,
                    'cohort' => $cohortEntry ? [
                        'id' => $cohortEntry['cohort']->id,
                        'name' => $cohortEntry['cohort']->name,
                        'starts_at' => $cohortEntry['cohort']->starts_at?->toISOString(),
                        'status' => $cohortEntry['cohort']->status,
                        'enrolled_at' => $cohortEntry['enrollment']->enrolled_at?->toISOString(),
                    ] : null,
                ];
            })->values(),
            'cohorts' => $bundle->cohorts->map(fn ($cohort) => [
                'id' => $cohort->id,
                'name' => $cohort->name,
                'starts_at' => $cohort->starts_at?->toISOString(),
                'enrollment_deadline' => $cohort->enrollment_deadline?->toISOString(),
                'capacity' => $cohort->capacity,
                'status' => $cohort->status,
                'enrolled_count' => $cohort->enrollments->where('status', 'active')->count(),
            ])->values(),
            'sessions' => $sessions,
        ]);
    }

    public function generateCheckInCode(Request $request, Merchant $merchant, Bundle $bundle, BundleLiveSession $session): JsonResponse
    {
        $this->ensureOwnership($request, $merchant, $bundle);
        $this->ensureSessionBelongsToBundle($session, $bundle);

        $session->update([
            'check_in_code' => (string) random_int(100000, 999999),
            'check_in_code_expires_at' => now()->addHours(6),
            'check_in_enabled' => true,
        ]);

        return response()->json([
            'message' => 'Check-in PIN generated.',
            'session' => [
                'id' => $session->id,
                'check_in_code' => $session->check_in_code,
                'check_in_code_expires_at' => $session->check_in_code_expires_at?->toISOString(),
                'check_in_enabled' => (bool) $session->check_in_enabled,
            ],
        ]);
    }

    public function markAttendance(Request $request, Merchant $merchant, Bundle $bundle, BundleLiveSession $session): JsonResponse
    {
        $this->ensureOwnership($request, $merchant, $bundle);
        $this->ensureSessionBelongsToBundle($session, $bundle);

        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'status' => 'nullable|string|in:present,late,absent,excused',
            'notes' => 'nullable|string|max:1000',
        ]);

        abort_unless($this->studentsForBundle($bundle)->contains('id', (int) $validated['user_id']), 422, 'Student is not enrolled in this course.');

        $attendance = BundleLiveSessionAttendance::updateOrCreate(
            [
                'bundle_live_session_id' => $session->id,
                'user_id' => (int) $validated['user_id'],
            ],
            [
                'marked_by_user_id' => $request->user()->id,
                'status' => $validated['status'] ?? 'present',
                'method' => 'merchant_manual',
                'checked_in_at' => in_array(($validated['status'] ?? 'present'), ['present', 'late'], true) ? now() : null,
                'notes' => $validated['notes'] ?? null,
            ]
        );

        return response()->json([
            'message' => 'Attendance updated.',
            'attendance' => $attendance->fresh('user'),
        ]);
    }

    private function studentsForBundle(Bundle $bundle): Collection
    {
        $entitledUserIds = Entitlement::query()
            ->where('item_type', 'bundle')
            ->where('item_id', $bundle->id)
            ->where('status', 'active')
            ->pluck('user_id');

        $cohortUserIds = BundleCohortEnrollment::query()
            ->where('status', 'active')
            ->whereHas('cohort', fn ($query) => $query->where('bundle_id', $bundle->id))
            ->pluck('user_id');

        return User::query()
            ->whereIn('id', $entitledUserIds->merge($cohortUserIds)->unique()->values())
            ->orderBy('name')
            ->get();
    }

    private function ensureOwnership(Request $request, Merchant $merchant, Bundle $bundle): void
    {
        abort_unless((int) $bundle->merchant_id === (int) $merchant->id, 404);
        abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);
    }

    private function ensureSessionBelongsToBundle(BundleLiveSession $session, Bundle $bundle): void
    {
        $session->loadMissing('lesson.module');
        abort_unless((int) $session->lesson?->module?->bundle_id === (int) $bundle->id, 404);
    }
}
