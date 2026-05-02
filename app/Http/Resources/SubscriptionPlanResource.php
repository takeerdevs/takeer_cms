<?php

namespace App\Http\Resources;

use App\Models\Bundle;
use App\Models\ContentItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionPlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->relationLoaded('items') ? $this->items : collect();
        $contentLookup = ContentItem::query()
            ->whereIn('id', $items->where('item_type', 'content_item')->pluck('item_id')->filter()->unique()->values())
            ->get(['id', 'slug', 'title', 'excerpt', 'price', 'visibility'])
            ->keyBy('id');
        $bundleLookup = Bundle::query()
            ->whereIn('id', $items->where('item_type', 'bundle')->pluck('item_id')->filter()->unique()->values())
            ->with('items')
            ->get(['id', 'slug', 'title', 'description', 'price', 'status', 'is_course'])
            ->keyBy('id');

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'price' => (float) $this->price,
            'billing_interval' => $this->billing_interval,
            'interval_count' => (int) $this->interval_count,
            'weekly_days' => $this->weekly_days,
            'monthly_day' => $this->monthly_day,
            'trial_days' => $this->trial_days,
            'tier' => (int) $this->tier,
            'status' => $this->status,
            'items' => $this->whenLoaded('items', fn () => $items->map(function ($item) use ($contentLookup, $bundleLookup) {
                $resolved = $item->item_type === 'content_item'
                    ? $contentLookup->get((int) $item->item_id)
                    : $bundleLookup->get((int) $item->item_id);

                return [
                    'id' => $item->id,
                    'item_type' => $item->item_type,
                    'item_id' => $item->item_id,
                    'unlock_after_days' => $item->unlock_after_days,
                    'title' => $resolved?->title,
                    'slug' => $resolved?->slug,
                    'description' => $resolved?->excerpt ?? $resolved?->description ?? null,
                    'price' => $resolved?->price !== null ? (float) $resolved->price : null,
                    'status' => $resolved?->visibility ?? $resolved?->status ?? null,
                    'is_course' => (bool) ($resolved?->is_course ?? false),
                ];
            })),
            'merchant' => $this->whenLoaded('merchant', fn () => [
                'id' => $this->merchant->id,
                'name' => $this->merchant->display_name,
                'slug' => $this->merchant->username,
            ]),
        ];
    }
}
