<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class MerchantGroupSaleCampaign extends Model
{
    protected $fillable = [
        'merchant_id',
        'product_id',
        'slug',
        'title',
        'description',
        'campaign_price',
        'regular_price',
        'goal_quantity',
        'reserved_quantity',
        'converted_quantity',
        'starts_at',
        'ends_at',
        'status',
        'allow_sms_updates',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'campaign_price' => 'decimal:2',
            'regular_price' => 'decimal:2',
            'goal_quantity' => 'integer',
            'reserved_quantity' => 'integer',
            'converted_quantity' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'allow_sms_updates' => 'boolean',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (MerchantGroupSaleCampaign $campaign): void {
            if (! $campaign->slug) {
                $base = Str::slug($campaign->title ?: 'group-sale') ?: 'group-sale';
                do {
                    $slug = $base.'-'.Str::lower(Str::random(5));
                } while (static::query()->where('slug', $slug)->exists());
                $campaign->slug = $slug;
            }
        });
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(MerchantGroupSaleParticipant::class, 'campaign_id');
    }

    public function progressPercent(): int
    {
        if ($this->goal_quantity <= 0) {
            return 0;
        }

        return (int) min(100, round(($this->reserved_quantity / $this->goal_quantity) * 100));
    }

    public function isJoinable(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }

        return ! $this->ends_at->isPast();
    }
}
