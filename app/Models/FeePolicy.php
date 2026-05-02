<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeePolicy extends Model
{
    protected $fillable = [
        'name',
        'category',
        'scope',
        'country_code',
        'currency_code',
        'merchant_id',
        'payment_channel',
        'fee_type',
        'percentage_rate',
        'fixed_amount',
        'fixed_fee_currency_code',
        'min_fee',
        'max_fee',
        'unit_size_gb',
        'billing_interval',
        'effective_from',
        'effective_until',
        'is_active',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'percentage_rate' => 'decimal:4',
            'fixed_amount' => 'decimal:2',
            'min_fee' => 'decimal:2',
            'max_fee' => 'decimal:2',
            'unit_size_gb' => 'decimal:2',
            'effective_from' => 'datetime',
            'effective_until' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
