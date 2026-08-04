<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class TryOnSession extends Model
{
    protected $fillable = [
        'public_id',
        'product_id',
        'product_variant_id',
        'user_id',
        'access_token_hash',
        'portrait_disk',
        'portrait_path',
        'portrait_mime',
        'portrait_size',
        'result_disk',
        'result_path',
        'result_mime',
        'status',
        'provider',
        'error_message',
        'metadata',
        'expires_at',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'product_id' => 'integer',
            'product_variant_id' => 'integer',
            'user_id' => 'integer',
            'portrait_size' => 'integer',
            'metadata' => 'array',
            'expires_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TryOnSession $session): void {
            $session->public_id ??= (string) Str::uuid();
        });
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hasAccessToken(string $token): bool
    {
        return hash_equals((string) $this->access_token_hash, hash('sha256', $token));
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
