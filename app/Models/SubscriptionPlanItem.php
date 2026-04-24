<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionPlanItem extends Model
{
    protected $fillable = [
        'subscription_plan_id',
        'item_type',
        'item_id',
        'unlock_after_days',
    ];

    protected function casts(): array
    {
        return [
            'item_id' => 'integer',
            'unlock_after_days' => 'integer',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }
}
