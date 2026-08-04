<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiUsageRecord extends Model
{
    protected $fillable = [
        'user_id',
        'scope_type',
        'merchant_id',
        'actor_user_id',
        'task_key',
        'route_version',
        'ai_provider_id',
        'provider_key',
        'ai_credential_id',
        'ai_model_id',
        'model_key',
        'credential_hint',
        'provider_request_id',
        'status',
        'attempt_number',
        'fallback_reason',
        'input_units',
        'output_units',
        'billable_units',
        'unit_type',
        'provider_cost',
        'input_rate_per_million',
        'output_rate_per_million',
        'pricing_source',
        'provider_cost_currency',
        'charged_credits',
        'started_at',
        'completed_at',
        'latency_ms',
        'error_code',
        'error_message',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'input_units' => 'decimal:4',
            'output_units' => 'decimal:4',
            'billable_units' => 'decimal:4',
            'provider_cost' => 'decimal:8',
            'input_rate_per_million' => 'decimal:8',
            'output_rate_per_million' => 'decimal:8',
            'charged_credits' => 'decimal:4',
            'attempt_number' => 'integer',
            'latency_ms' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(AiProvider::class, 'ai_provider_id');
    }

    public function model(): BelongsTo
    {
        return $this->belongsTo(AiModel::class, 'ai_model_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
