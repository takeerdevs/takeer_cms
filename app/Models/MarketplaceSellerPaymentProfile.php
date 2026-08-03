<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketplaceSellerPaymentProfile extends Model
{
    protected $fillable = [
        'merchant_id', 'payment_provider_id', 'provider_merchant_id', 'provider_submerchant_id',
        'onboarding_status', 'kyc_status', 'beneficiary_status', 'payouts_enabled', 'collections_enabled',
        'provider_country_code', 'provider_currency_codes', 'provider_status_reference', 'onboarded_at',
        'verified_at', 'suspended_at', 'last_synced_at', 'restrictions', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'provider_currency_codes' => 'array',
            'payouts_enabled' => 'boolean',
            'collections_enabled' => 'boolean',
            'onboarded_at' => 'datetime',
            'verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'last_synced_at' => 'datetime',
            'restrictions' => 'array',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(ProviderPayout::class, 'seller_payment_profile_id');
    }

    public function isPayoutReady(): bool
    {
        return $this->payouts_enabled
            && $this->beneficiary_status === 'verified'
            && $this->onboarding_status === 'approved'
            && $this->suspended_at === null;
    }
}
