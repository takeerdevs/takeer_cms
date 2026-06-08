<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantPayoutCredential extends Model
{
    protected $fillable = [
        'merchant_id',
        'payment_provider_channel_id',
        'label',
        'method',
        'network',
        'currency_code',
        'details_encrypted',
        'details_masked',
        'verification_status',
        'verified_at',
        'is_default',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'details_encrypted' => 'encrypted:array',
            'details_masked' => 'array',
            'verified_at' => 'datetime',
            'is_default' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(PaymentProviderChannel::class, 'payment_provider_channel_id');
    }
}
