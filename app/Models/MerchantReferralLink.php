<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantReferralLink extends Model
{
    protected $fillable = [
        'merchant_id',
        'created_by',
        'code',
        'label',
        'target_type',
        'target_id',
        'reward_type',
        'reward_value',
        'clicks_count',
        'conversions_count',
        'revenue_amount',
        'last_clicked_at',
        'last_converted_at',
        'starts_at',
        'ends_at',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'target_id' => 'integer',
            'reward_value' => 'decimal:2',
            'clicks_count' => 'integer',
            'conversions_count' => 'integer',
            'revenue_amount' => 'decimal:2',
            'last_clicked_at' => 'datetime',
            'last_converted_at' => 'datetime',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'merchant_referral_link_id');
    }

    public function isActiveNow(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }

        return true;
    }

    public function matchesPurchase(string $type, int $id, int $merchantId): bool
    {
        if ((int) $this->merchant_id !== $merchantId) {
            return false;
        }

        return $this->target_type === 'storefront'
            || ($this->target_type === $type && (int) $this->target_id === $id);
    }
}
