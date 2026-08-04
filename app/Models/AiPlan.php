<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiPlan extends Model
{
    protected $fillable = [
        'key',
        'scope_type',
        'name',
        'description',
        'feature_group',
        'price',
        'currency_code',
        'billing_interval',
        'claim_frequency',
        'included_credits',
        'overage_allowed',
        'overage_credit_price',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'included_credits' => 'decimal:4',
            'overage_allowed' => 'boolean',
            'overage_credit_price' => 'decimal:4',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function limits(): HasMany
    {
        return $this->hasMany(AiPlanLimit::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(AiSubscription::class);
    }

    public function legacySubscriptions(): HasMany
    {
        return $this->hasMany(UserAiSubscription::class);
    }
}
