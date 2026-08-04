<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiSubscription extends Model
{
    protected $fillable = [
        'ai_plan_id',
        'scope_type',
        'user_id',
        'merchant_id',
        'status',
        'current_period_start',
        'current_period_end',
        'source_type',
        'source_id',
        'claim_key',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'source_id' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AiPlan::class, 'ai_plan_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function isCurrent(): bool
    {
        return $this->status === 'active'
            && (! $this->current_period_start || $this->current_period_start->isPast())
            && (! $this->current_period_end || $this->current_period_end->isFuture());
    }
}
