<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentProviderChannel extends Model
{
    protected $fillable = [
        'payment_provider_id',
        'key',
        'country_code',
        'direction',
        'method',
        'network',
        'name',
        'logo_url',
        'currencies',
        'status',
        'priority',
        'required_fields_schema',
        'supported_networks',
        'supported_banks',
        'limits',
        'fee_type',
        'fee_fixed',
        'fee_percent_bps',
        'fee_min',
        'fee_max',
        'fx_margin_bps',
        'settlement_note',
        'provider_metadata',
    ];

    protected function casts(): array
    {
        return [
            'currencies' => 'array',
            'priority' => 'integer',
            'required_fields_schema' => 'array',
            'supported_networks' => 'array',
            'supported_banks' => 'array',
            'limits' => 'array',
            'fee_fixed' => 'decimal:2',
            'fee_percent_bps' => 'integer',
            'fee_min' => 'decimal:2',
            'fee_max' => 'decimal:2',
            'fx_margin_bps' => 'integer',
            'provider_metadata' => 'array',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }

    public function payoutCredentials(): HasMany
    {
        return $this->hasMany(MerchantPayoutCredential::class, 'payment_provider_channel_id');
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(PaymentChannelIncident::class);
    }

    public function treasuryAccounts(): HasMany
    {
        return $this->hasMany(ProviderTreasuryAccount::class, 'payment_provider_channel_id');
    }

    public function isAvailable(): bool
    {
        return $this->status === 'enabled' && $this->provider?->isAvailable();
    }
}
