<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiCreditAccount extends Model
{
    protected $fillable = ['user_id', 'merchant_id', 'scope_type', 'balance', 'reserved_balance'];

    protected function casts(): array
    {
        return [
            'balance' => 'decimal:4',
            'reserved_balance' => 'decimal:4',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(AiCreditTransaction::class);
    }

    public function grants(): HasMany
    {
        return $this->hasMany(AiCreditGrant::class);
    }
}
