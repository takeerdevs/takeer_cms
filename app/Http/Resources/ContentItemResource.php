<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContentItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'body' => $this->when($request->boolean('include_body', false), $this->body),
            'format' => $this->format,
            'visibility' => $this->visibility,
            'price' => $this->price !== null ? (float) $this->price : null,
            'moderation_status' => $this->moderation_status,
            'published_at' => $this->published_at?->toISOString(),
            'merchant' => $this->whenLoaded('merchant', fn () => [
                'id' => $this->merchant->id,
                'name' => $this->merchant->display_name,
                'slug' => $this->merchant->username,
            ]),
        ];
    }
}
