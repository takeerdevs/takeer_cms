<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProviderTreasuryAccount extends Model
{
    protected $fillable = [
        'payment_provider_id',
        'payment_provider_channel_id',
        'provider_key',
        'provider_channel_key',
        'country_code',
        'method',
        'currency_code',
        'balance_amount',
        'reserved_amount',
        'minimum_available_amount',
        'status',
        'balance_source',
        'last_synced_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'balance_amount' => 'decimal:2',
            'reserved_amount' => 'decimal:2',
            'minimum_available_amount' => 'decimal:2',
            'last_synced_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(PaymentProviderChannel::class, 'payment_provider_channel_id');
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(ProviderTreasuryReservation::class, 'provider_treasury_account_id');
    }

    public function availableAmount(): float
    {
        return round(max(0, (float) $this->balance_amount - (float) $this->reserved_amount - (float) $this->minimum_available_amount), 2);
    }
}
