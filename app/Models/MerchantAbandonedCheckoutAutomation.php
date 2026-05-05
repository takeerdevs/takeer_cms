<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantAbandonedCheckoutAutomation extends Model
{
    protected $fillable = [
        'merchant_id',
        'created_by',
        'is_enabled',
        'delay_minutes',
        'max_age_days',
        'coupon_code',
        'message',
        'last_run_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'delay_minutes' => 'integer',
            'max_age_days' => 'integer',
            'last_run_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function recoveries(): HasMany
    {
        return $this->hasMany(MerchantAbandonedCheckoutRecovery::class, 'automation_id');
    }
}
