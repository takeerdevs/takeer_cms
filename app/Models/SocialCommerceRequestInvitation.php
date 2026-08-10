<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class SocialCommerceRequestInvitation extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_id', 'short_code', 'social_commerce_request_id', 'channel', 'recipient_encrypted', 'recipient_hash',
        'token_hash', 'short_token_hash', 'status', 'provider_reference', 'attempt_count', 'dedupe_key', 'message_snapshot',
        'metadata', 'queued_at', 'sent_at', 'failed_at', 'clicked_at', 'claimed_at', 'expires_at', 'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'recipient_encrypted' => 'encrypted',
            'message_snapshot' => 'array',
            'metadata' => 'array',
            'queued_at' => 'datetime',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
            'clicked_at' => 'datetime',
            'claimed_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $invitation): void {
            $invitation->public_id ??= Str::random(20);
        });
    }

    public function getRouteKeyName(): string { return 'public_id'; }
    public function request(): BelongsTo { return $this->belongsTo(SocialCommerceRequest::class, 'social_commerce_request_id'); }

    public function isClaimable(?string $plainToken): bool
    {
        $tokenHash = $plainToken !== null ? hash('sha256', $plainToken) : null;

        return $plainToken !== null
            && $this->status !== 'revoked'
            && $this->status !== 'claimed'
            && $this->expires_at?->isFuture()
            && (
                hash_equals((string) $this->token_hash, (string) $tokenHash)
                || ($this->short_token_hash && hash_equals((string) $this->short_token_hash, (string) $tokenHash))
            );
    }
}
