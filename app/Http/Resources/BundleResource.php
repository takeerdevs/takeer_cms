<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BundleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'description' => $this->description,
            'price' => $this->price !== null ? (float) $this->price : null,
            'is_individual_sale' => (bool) $this->is_individual_sale,
            'is_course' => (bool) ($this->is_course ?? false),
            'course_format' => $this->course_format,
            'course_outcomes' => $this->course_outcomes ?? [],
            'course_requirements' => $this->course_requirements ?? [],
            'course_cover_image_url' => $this->course_cover_image_url,
            'status' => $this->status,
            'course_modules' => $this->whenLoaded('courseModules', fn () => $this->courseModules->map(fn ($module) => [
                'id' => $module->id,
                'title' => $module->title,
                'sort_order' => (int) ($module->sort_order ?? 0),
                'lessons' => $module->lessons->map(fn ($lesson) => [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'summary' => $lesson->summary,
                    'duration_minutes' => $lesson->duration_minutes !== null ? (int) $lesson->duration_minutes : null,
                    'unlock_after_days' => (int) ($lesson->unlock_after_days ?? 0),
                    'is_preview' => (bool) ($lesson->is_preview ?? false),
                    'sort_order' => (int) ($lesson->sort_order ?? 0),
                    'assets' => $lesson->assets->map(fn ($asset) => [
                        'id' => $asset->id,
                        'role' => $asset->role,
                        'asset_type' => $asset->asset_type,
                        'asset_id' => $asset->asset_id !== null ? (int) $asset->asset_id : null,
                        'selected_variant_id' => $asset->selected_variant_id !== null ? (int) $asset->selected_variant_id : null,
                        'selected_variant_snapshot' => $asset->selected_variant_snapshot,
                        'name' => $asset->name,
                        'url' => $asset->url,
                        'mime' => $asset->mime,
                        'size' => $asset->size !== null ? (int) $asset->size : null,
                        'sort_order' => (int) ($asset->sort_order ?? 0),
                    ]),
                    'live_session' => $lesson->liveSession ? [
                        'id' => $lesson->liveSession->id,
                        'starts_at' => $lesson->liveSession->starts_at?->toISOString(),
                        'duration_minutes' => $lesson->liveSession->duration_minutes !== null ? (int) $lesson->liveSession->duration_minutes : null,
                        'timezone' => $lesson->liveSession->timezone,
                        'meeting_url' => $lesson->liveSession->meeting_url,
                        'venue' => $lesson->liveSession->venue,
                        'capacity' => $lesson->liveSession->capacity !== null ? (int) $lesson->liveSession->capacity : null,
                        'notes' => $lesson->liveSession->notes,
                    ] : null,
                ]),
            ])),
            'cohorts' => $this->whenLoaded('cohorts', fn () => $this->cohorts->map(fn ($cohort) => [
                'id' => $cohort->id,
                'name' => $cohort->name,
                'starts_at' => $cohort->starts_at?->toISOString(),
                'enrollment_deadline' => $cohort->enrollment_deadline?->toISOString(),
                'capacity' => $cohort->capacity !== null ? (int) $cohort->capacity : null,
                'access_rule' => $cohort->access_rule,
                'status' => $cohort->status,
            ])),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'item_type' => $item->item_type,
                'item_id' => $item->item_id,
                'selected_variant_id' => $item->selected_variant_id ? (int) $item->selected_variant_id : null,
                'selected_variant_snapshot' => $item->selected_variant_snapshot,
                'section_title' => $item->section_title,
                'lesson_title' => $item->lesson_title,
                'lesson_summary' => $item->lesson_summary,
                'supporting_materials' => $item->supporting_materials ?? [],
                'lesson_duration_minutes' => $item->lesson_duration_minutes !== null ? (int) $item->lesson_duration_minutes : null,
                'unlock_after_days' => (int) ($item->unlock_after_days ?? 0),
                'is_preview' => (bool) ($item->is_preview ?? false),
                'sort_order' => $item->sort_order,
            ])),
            'merchant' => $this->whenLoaded('merchant', fn () => [
                'id' => $this->merchant->id,
                'name' => $this->merchant->display_name,
                'slug' => $this->merchant->username,
            ]),
        ];
    }
}
