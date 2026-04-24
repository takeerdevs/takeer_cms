<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $this->user;
        $publicIdentifier = $this->maskedPublicPhone($user?->phone_number);
        $displayName = $publicIdentifier
            ?: trim((string) ($user?->name ?? ''))
            ?: 'User';

        return [
            'id' => $this->id,
            'post_id' => $this->post_id,
            'parent_id' => $this->parent_id,
            'text' => $this->text,
            'created_at' => $this->created_at->diffForHumans(),
            'user' => [
                'id' => $user?->id,
                'name' => $displayName,
                'public_identifier' => $publicIdentifier ?: $displayName,
            ],
            'replies' => CommentResource::collection($this->whenLoaded('replies')),
        ];
    }

    private function maskedPublicPhone(?string $phone): ?string
    {
        if (!$phone) {
            return null;
        }

        $normalized = preg_replace('/[^+\d]/', '', trim($phone));
        if (!$normalized) {
            return null;
        }

        $countryPrefix = '+';
        $tail = substr(preg_replace('/\D/', '', $normalized), -2);
        $digits = preg_replace('/\D/', '', $normalized);
        $prefixLength = max(1, min(3, strlen($digits) - 2));
        $countryPrefix = '+' . substr($digits, 0, $prefixLength);

        if (!$tail) {
            return $countryPrefix . '***';
        }

        return $countryPrefix . '***' . $tail;
    }
}
