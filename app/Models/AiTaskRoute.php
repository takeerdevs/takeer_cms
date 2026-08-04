<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiTaskRoute extends Model
{
    protected $fillable = [
        'task_key',
        'label',
        'description',
        'required_capability',
        'primary_model_id',
        'fallback_model_ids',
        'credit_cost',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'fallback_model_ids' => 'array',
            'credit_cost' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    public function primaryModel(): BelongsTo
    {
        return $this->belongsTo(AiModel::class, 'primary_model_id');
    }
}
