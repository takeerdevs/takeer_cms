<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiPlanLimit extends Model
{
    protected $fillable = [
        'ai_plan_id',
        'task_key',
        'included_units',
        'credit_cost_override',
        'period',
        'is_enabled',
    ];

    protected function casts(): array
    {
        return [
            'included_units' => 'decimal:4',
            'credit_cost_override' => 'decimal:4',
            'is_enabled' => 'boolean',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AiPlan::class, 'ai_plan_id');
    }
}
