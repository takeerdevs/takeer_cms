<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiCreditAllocation extends Model
{
    protected $fillable = [
        'ai_credit_transaction_id',
        'ai_credit_grant_id',
        'amount',
    ];

    protected function casts(): array
    {
        return ['amount' => 'decimal:4'];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(AiCreditTransaction::class, 'ai_credit_transaction_id');
    }

    public function grant(): BelongsTo
    {
        return $this->belongsTo(AiCreditGrant::class, 'ai_credit_grant_id');
    }
}
