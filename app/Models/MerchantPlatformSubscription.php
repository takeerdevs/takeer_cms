<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantPlatformSubscription extends Model
{
    protected $fillable = [
        'merchant_id',
        'feature',
        'status',
        'currency_code',
        'amount',
        'billing_interval',
        'storage_mb',
        'started_at',
        'trial_ends_at',
        'current_period_start',
        'current_period_end',
        'next_billing_at',
        'last_paid_at',
        'cancelled_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'storage_mb' => 'integer',
            'started_at' => 'datetime',
            'trial_ends_at' => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'next_billing_at' => 'datetime',
            'last_paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(MerchantPlatformSubscriptionPayment::class);
    }
}
