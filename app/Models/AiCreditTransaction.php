<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiCreditTransaction extends Model
{
    protected $fillable = [
        'user_id',
        'scope_type',
        'merchant_id',
        'actor_user_id',
        'ai_credit_account_id',
        'ai_credit_grant_id',
        'ai_usage_record_id',
        'transaction_type',
        'amount',
        'balance_after',
        'task_key',
        'idempotency_key',
        'expires_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'balance_after' => 'decimal:4',
            'expires_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AiCreditAccount::class, 'ai_credit_account_id');
    }

    public function usage(): BelongsTo
    {
        return $this->belongsTo(AiUsageRecord::class, 'ai_usage_record_id');
    }

    public function grant(): BelongsTo
    {
        return $this->belongsTo(AiCreditGrant::class, 'ai_credit_grant_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(AiCreditAllocation::class, 'ai_credit_transaction_id');
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
