<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone_number' => $this->phone_number,
            'role' => $this->role,
            'has_one_click_profile' => $this->whenLoaded('oneClickProfile', fn() => !is_null($this->oneClickProfile)),
            'wallet_balance' => $this->whenLoaded('wallet', fn() => $this->wallet?->balance),
            'created_at' => $this->created_at?->toDateString(),
        ];
    }
}
