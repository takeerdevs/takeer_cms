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
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'item_type' => $item->item_type,
                'item_id' => $item->item_id,
                'selected_variant_id' => $item->selected_variant_id ? (int) $item->selected_variant_id : null,
                'selected_variant_snapshot' => $item->selected_variant_snapshot,
                'section_title' => $item->section_title,
                'lesson_title' => $item->lesson_title,
                'lesson_summary' => $item->lesson_summary,
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
