<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAiSubscription extends Model
{
    protected $fillable = [
        'user_id',
        'ai_plan_id',
        'status',
        'current_period_start',
        'current_period_end',
        'source_type',
        'source_id',
    ];

    protected function casts(): array
    {
        return [
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'source_id' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AiPlan::class, 'ai_plan_id');
    }
}
