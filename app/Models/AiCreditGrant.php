<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiCreditGrant extends Model
{
    protected $fillable = [
        'ai_credit_account_id',
        'user_id',
        'merchant_id',
        'scope_type',
        'grant_key',
        'source_type',
        'source_id',
        'amount',
        'remaining_amount',
        'reserved_amount',
        'expires_at',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'remaining_amount' => 'decimal:4',
            'reserved_amount' => 'decimal:4',
            'expires_at' => 'datetime',
            'source_id' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(AiCreditAccount::class, 'ai_credit_account_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(AiCreditTransaction::class, 'ai_credit_grant_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(AiCreditAllocation::class);
    }

    public function isUsable(): bool
    {
        return $this->status === 'active'
            && (float) $this->remaining_amount > 0
            && (! $this->expires_at || $this->expires_at->isFuture());
    }
}
