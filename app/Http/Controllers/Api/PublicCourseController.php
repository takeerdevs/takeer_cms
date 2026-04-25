<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Course;
use App\Models\CourseLesson;
use App\Models\CourseProgress;
use App\Services\EntitlementService;
use App\Services\MediaUploadService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PublicCourseController extends Controller
{
    public function show(Request $request, Product $product, EntitlementService $entitlementService, MediaUploadService $mediaService)
    {
        $user = $request->user();
        $course = $product->course()->with(['modules.lessons'])->first();

        if (!$course) {
            abort(404, 'Course not found');
        }

        $hasFullAccess = $user ? $entitlementService->hasAccess($user->id, 'product', $product->id) : false;

        // If the merchant themselves is viewing, give full access
        $merchant = $user ? $user->merchantProfiles()->where('id', $product->merchant_id)->exists() : false;
        if ($merchant) {
            $hasFullAccess = true;
        }

        $completedLessonIds = $user 
            ? CourseProgress::where('user_id', $user->id)
                ->whereIn('course_lesson_id', $course->modules->flatMap->lessons->pluck('id'))
                ->pluck('course_lesson_id')
                ->toArray()
            : [];

        // Prepare curriculum with signed URLs for lessons the user has access to
        $curriculum = $course->modules->map(function ($module) use ($hasFullAccess, $mediaService, $completedLessonIds) {
            return [
                'id' => $module->id,
                'title' => $module->title,
                'lessons' => $module->lessons->map(function ($lesson) use ($hasFullAccess, $mediaService, $completedLessonIds) {
                    $canView = $hasFullAccess || $lesson->is_preview;
                    
                    $contentUrl = null;
                    if ($canView && $lesson->content_url) {
                        // If it's a private S3 path, sign it
                        if (str_starts_with($lesson->content_url, 'course-lessons/')) {
                            $contentUrl = $mediaService->getSignedUrl($lesson->content_url);
                        } else {
                            $contentUrl = $lesson->content_url;
                        }
                    }

                    return [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'type' => $lesson->type,
                        'content_url' => $contentUrl,
                        'is_preview' => $lesson->is_preview,
                        'is_locked' => !$canView,
                        'is_completed' => in_array($lesson->id, $completedLessonIds),
                        'body' => $canView ? $lesson->body : null,
                    ];
                }),
            ];
        });

        return Inertia::render('Public/CoursePlayer', [
            'product' => $product->load('merchant'),
            'course' => [
                'id' => $course->id,
                'welcome_message' => $course->welcome_message,
                'curriculum' => $curriculum,
            ],
            'hasFullAccess' => $hasFullAccess,
        ]);
    }

    public function toggleCompletion(Request $request, CourseLesson $lesson)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Tafadhali ingia ili kuhifadhi hatua zako.'], 401);
        }

        $progress = CourseProgress::where('user_id', $user->id)
            ->where('course_lesson_id', $lesson->id)
            ->first();

        if ($progress) {
            $progress->delete();
            return response()->json(['completed' => false]);
        } else {
            CourseProgress::create([
                'user_id' => $user->id,
                'course_lesson_id' => $lesson->id,
                'completed_at' => now(),
            ]);
            return response()->json(['completed' => true]);
        }
    }
}
