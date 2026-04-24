<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UserSubscription extends Model
{
    protected $fillable = [
        'user_id',
        'merchant_id',
        'subscription_plan_id',
        'status',
        'auto_renew',
        'started_at',
        'current_period_start',
        'current_period_end',
        'next_billing_at',
        'cancelled_at',
        'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'auto_renew' => 'boolean',
            'started_at' => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'next_billing_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(SubscriptionInvoice::class);
    }
}
