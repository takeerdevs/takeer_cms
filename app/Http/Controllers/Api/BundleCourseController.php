<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\BundleCohortEnrollment;
use App\Models\BundleCourseLesson;
use App\Models\BundleCourseProgress;
use App\Models\BundleLiveSession;
use App\Models\BundleLiveSessionAttendance;
use App\Models\ContentItem;
use App\Models\Post;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BundleCourseController extends Controller
{
    public function show(Request $request, Bundle $bundle, EntitlementService $entitlementService)
    {
        abort_unless($bundle->is_course, 404, 'Course not found.');

        $bundle->load([
            'merchant',
            'courseModules.lessons.assets',
            'courseModules.lessons.liveSession.attendances',
            'cohorts.enrollments' => fn ($query) => $query->where('user_id', $request->user()->id),
        ]);

        $user = $request->user();
        $isOwner = $user?->merchantProfiles()->where('id', $bundle->merchant_id)->exists() ?? false;
        $hasFullAccess = $isOwner || $entitlementService->hasAccess($user->id, 'bundle', $bundle->id);

        abort_unless($hasFullAccess || $bundle->courseModules->flatMap->lessons->contains(fn ($lesson) => $lesson->is_preview), 403, 'You do not have access to this course.');

        $lessonIds = $bundle->courseModules->flatMap->lessons->pluck('id')->values();
        $completedLessonIds = BundleCourseProgress::query()
            ->where('user_id', $user->id)
            ->whereIn('bundle_course_lesson_id', $lessonIds)
            ->pluck('bundle_course_lesson_id')
            ->all();

        $contentItems = ContentItem::query()
            ->whereIn('id', $bundle->courseModules
                ->flatMap->lessons
                ->flatMap->assets
                ->where('asset_type', 'content_item')
                ->pluck('asset_id')
                ->filter()
                ->unique()
                ->values())
            ->get()
            ->keyBy('id');

        $linkedPosts = Post::query()
            ->with('media')
            ->whereIn('content_item_id', $contentItems->keys())
            ->get()
            ->keyBy('content_item_id');
        $postAssets = Post::query()
            ->with('media')
            ->whereIn('id', $bundle->courseModules
                ->flatMap->lessons
                ->flatMap->assets
                ->where('asset_type', 'post')
                ->pluck('asset_id')
                ->filter()
                ->unique()
                ->values())
            ->get()
            ->keyBy('id');

        $curriculum = $bundle->courseModules->map(fn ($module) => [
            'id' => $module->id,
            'title' => $module->title,
            'lessons' => $module->lessons->map(function ($lesson) use ($hasFullAccess, $completedLessonIds, $user, $contentItems, $linkedPosts, $postAssets) {
                $canView = $hasFullAccess || $lesson->is_preview;
                $primaryAsset = $lesson->assets->firstWhere('role', 'primary');

                return [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'type' => $primaryAsset?->mime && str_starts_with((string) $primaryAsset->mime, 'video/') ? 'video' : 'resource',
                    'content_url' => null,
                    'primary_asset' => $primaryAsset ? $this->assetPayload($primaryAsset, $canView, $contentItems, $linkedPosts, $postAssets) : null,
                    'supporting_assets' => $lesson->assets
                        ->filter(fn ($asset) => $asset->role !== 'primary')
                        ->values()
                        ->map(fn ($asset) => $this->assetPayload($asset, $canView, $contentItems, $linkedPosts, $postAssets)),
                    'live_session' => $lesson->liveSession ? [
                        'starts_at' => $lesson->liveSession->starts_at?->toISOString(),
                        'duration_minutes' => $lesson->liveSession->duration_minutes,
                        'timezone' => $lesson->liveSession->timezone,
                        'meeting_url' => $canView ? $lesson->liveSession->meeting_url : null,
                        'venue' => $lesson->liveSession->venue,
                        'capacity' => $lesson->liveSession->capacity,
                        'notes' => $lesson->liveSession->notes,
                        'id' => $lesson->liveSession->id,
                        'check_in_enabled' => (bool) $lesson->liveSession->check_in_enabled,
                        'checked_in' => $lesson->liveSession->attendances
                            ->contains(fn ($attendance) => (int) $attendance->user_id === (int) $user->id && in_array($attendance->status, ['present', 'late'], true)),
                    ] : null,
                    'duration_minutes' => $lesson->duration_minutes,
                    'unlock_after_days' => $lesson->unlock_after_days,
                    'is_preview' => $lesson->is_preview,
                    'is_locked' => !$canView,
                    'is_completed' => in_array($lesson->id, $completedLessonIds, true),
                    'body' => $canView ? $lesson->summary : null,
                ];
            })->values(),
        ])->values();

        $activeEnrollment = BundleCohortEnrollment::query()
            ->with('cohort')
            ->where('user_id', $user->id)
            ->whereHas('cohort', fn ($query) => $query->where('bundle_id', $bundle->id))
            ->where('status', 'active')
            ->latest('enrolled_at')
            ->first();

        return Inertia::render('Public/CoursePlayer', [
            'product' => [
                'id' => $bundle->id,
                'title' => $bundle->title,
                'image_url' => $bundle->course_cover_image_url,
                'merchant' => [
                    'display_name' => $bundle->merchant?->display_name,
                    'username' => $bundle->merchant?->username,
                ],
            ],
            'course' => [
                'id' => $bundle->id,
                'type' => 'bundle',
                'format' => $bundle->course_format,
                'welcome_message' => $bundle->description,
                'curriculum' => $curriculum,
                'cohort' => $activeEnrollment?->cohort ? [
                    'name' => $activeEnrollment->cohort->name,
                    'starts_at' => $activeEnrollment->cohort->starts_at?->toISOString(),
                    'enrollment_deadline' => $activeEnrollment->cohort->enrollment_deadline?->toISOString(),
                    'capacity' => $activeEnrollment->cohort->capacity,
                    'status' => $activeEnrollment->cohort->status,
                ] : null,
            ],
            'hasFullAccess' => $hasFullAccess,
        ]);
    }

    public function toggleCompletion(Request $request, BundleCourseLesson $lesson, EntitlementService $entitlementService): JsonResponse
    {
        $lesson->loadMissing('module.bundle');
        $bundle = $lesson->module?->bundle;
        abort_unless($bundle, 404, 'Lesson not found.');

        $user = $request->user();
        $isOwner = $user?->merchantProfiles()->where('id', $bundle->merchant_id)->exists() ?? false;
        $hasAccess = $isOwner || $entitlementService->hasAccess($user->id, 'bundle', $bundle->id) || $lesson->is_preview;
        abort_unless($hasAccess, 403, 'You do not have access to this lesson.');

        $progress = BundleCourseProgress::query()
            ->where('user_id', $user->id)
            ->where('bundle_course_lesson_id', $lesson->id)
            ->first();

        if ($progress) {
            $progress->delete();
            return response()->json(['completed' => false]);
        }

        BundleCourseProgress::create([
            'user_id' => $user->id,
            'bundle_course_lesson_id' => $lesson->id,
            'completed_at' => now(),
        ]);

        return response()->json(['completed' => true]);
    }

    public function checkIn(Request $request, BundleLiveSession $session, EntitlementService $entitlementService): JsonResponse
    {
        $validated = $request->validate([
            'code' => 'required|string|max:12',
        ]);

        $session->loadMissing('lesson.module.bundle');
        $bundle = $session->lesson?->module?->bundle;
        abort_unless($bundle, 404, 'Live session not found.');

        $user = $request->user();
        $hasAccess = $entitlementService->hasAccess($user->id, 'bundle', $bundle->id);
        abort_unless($hasAccess, 403, 'You do not have access to this live session.');

        abort_unless($session->check_in_enabled && $session->check_in_code, 422, 'Check-in is not open for this session.');
        abort_if($session->check_in_code_expires_at && $session->check_in_code_expires_at->isPast(), 422, 'Check-in PIN has expired.');
        abort_unless(hash_equals((string) $session->check_in_code, trim((string) $validated['code'])), 422, 'Invalid check-in PIN.');

        $attendance = BundleLiveSessionAttendance::updateOrCreate(
            [
                'bundle_live_session_id' => $session->id,
                'user_id' => $user->id,
            ],
            [
                'status' => 'present',
                'method' => 'pin',
                'checked_in_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Umefanikiwa kufanya check-in.',
            'checked_in' => true,
            'attendance_id' => $attendance->id,
        ]);
    }

    private function assetPayload($asset, bool $canView = false, $contentItems = null, $linkedPosts = null, $postAssets = null): array
    {
        $payload = [
            'id' => $asset->id,
            'role' => $asset->role,
            'asset_type' => $asset->asset_type,
            'asset_id' => $asset->asset_id,
            'name' => $asset->name,
            'mime' => $asset->mime,
            'size' => $asset->size,
        ];

        if ($asset->asset_type === 'content_item' && $canView) {
            $contentItem = $contentItems?->get((int) $asset->asset_id);
            if ($contentItem) {
                $linkedPost = $linkedPosts?->get((int) $asset->asset_id);

                $payload['content_item'] = [
                    'id' => $contentItem->id,
                    'title' => $contentItem->title,
                    'excerpt' => $contentItem->excerpt,
                    'body' => $contentItem->body,
                    'format' => $contentItem->format,
                    'visibility' => $contentItem->visibility,
                    'linked_post' => $linkedPost ? [
                        'id' => $linkedPost->id,
                        'public_id' => $linkedPost->public_id,
                        'title' => $linkedPost->title,
                        'excerpt' => $linkedPost->excerpt,
                        'body' => $linkedPost->body,
                        'caption' => $linkedPost->caption,
                        'bg_style' => $linkedPost->bg_style,
                        'media' => $linkedPost->media->map(fn ($media) => [
                            'id' => $media->id,
                            'media_type' => $media->media_type,
                            'media_url' => $media->media_url,
                        ])->values()->all(),
                    ] : null,
                ];
            }
        }

        if ($asset->asset_type === 'post' && $canView) {
            $post = $postAssets?->get((int) $asset->asset_id);
            if ($post) {
                $payload['post'] = [
                    'id' => $post->id,
                    'public_id' => $post->public_id,
                    'title' => $post->title,
                    'excerpt' => $post->excerpt,
                    'body' => $post->body,
                    'caption' => $post->caption,
                    'bg_style' => $post->bg_style,
                    'media' => $post->media->map(fn ($media) => [
                        'id' => $media->id,
                        'media_type' => $media->media_type,
                        'media_url' => $media->media_url,
                    ])->values()->all(),
                ];
            }
        }

        return $payload;
    }
}
