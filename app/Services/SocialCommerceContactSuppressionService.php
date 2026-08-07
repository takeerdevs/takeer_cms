<?php

namespace App\Services;

use App\Models\SocialCommerceContactSuppression;
use Illuminate\Support\Facades\DB;

class SocialCommerceContactSuppressionService
{
    public function __construct(private readonly SocialCommerceRequestService $requests) {}
    public function isSuppressed(?string $contact): bool
    {
        if (!trim((string) $contact)) return false;
        return SocialCommerceContactSuppression::query()->where('contact_hash', $this->hash($contact))->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))->exists();
    }
    public function suppress(string $contact, ?string $reason = null): void
    {
        SocialCommerceContactSuppression::query()->updateOrCreate(['contact_hash' => $this->hash($contact)], ['reason' => $reason ?: 'seller_opt_out', 'created_at' => now()]);
    }
    public function hash(string $contact): string { return $this->requests->contactHash($contact); }
}
