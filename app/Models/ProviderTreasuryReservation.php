<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderTreasuryReservation extends Model
{
    protected $fillable = [
        'provider_treasury_account_id',
        'withdrawal_request_id',
        'status',
        'amount',
        'payout_amount',
        'provider_cost_amount',
        'currency_code',
        'reserved_at',
        'captured_at',
        'released_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payout_amount' => 'decimal:2',
            'provider_cost_amount' => 'decimal:2',
            'reserved_at' => 'datetime',
            'captured_at' => 'datetime',
            'released_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(ProviderTreasuryAccount::class, 'provider_treasury_account_id');
    }

    public function withdrawal(): BelongsTo
    {
        return $this->belongsTo(WithdrawalRequest::class, 'withdrawal_request_id');
    }
}
