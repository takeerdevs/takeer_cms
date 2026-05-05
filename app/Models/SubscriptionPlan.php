<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SubscriptionPlan extends Model
{
    use SoftDeletes;

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    protected $fillable = [
        'merchant_id',
        'name',
        'slug',
        'description',
        'price',
        'currency_id',
        'billing_interval',
        'interval_count',
        'weekly_days',
        'monthly_day',
        'trial_days',
        'tier',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'interval_count' => 'integer',
            'weekly_days' => 'array',
            'monthly_day' => 'integer',
            'trial_days' => 'integer',
            'tier' => 'integer',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SubscriptionPlanItem::class)->orderBy('unlock_after_days');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(UserSubscription::class);
    }
}
