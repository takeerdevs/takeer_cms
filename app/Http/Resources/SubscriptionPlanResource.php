<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionPlanResource extends JsonResource
{
    public function toArray(Request $request): array
    {
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
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'item_type' => $item->item_type,
                'item_id' => $item->item_id,
                'unlock_after_days' => $item->unlock_after_days,
            ])),
            'merchant' => $this->whenLoaded('merchant', fn () => [
                'id' => $this->merchant->id,
                'name' => $this->merchant->display_name,
                'slug' => $this->merchant->username,
            ]),
        ];
    }
}
