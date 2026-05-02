<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantPlatformSubscriptionPayment extends Model
{
    protected $fillable = [
        'merchant_platform_subscription_id',
        'merchant_id',
        'feature',
        'amount',
        'currency_code',
        'payment_method',
        'status',
        'provider_reference',
        'paid_at',
        'policy_snapshot',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'policy_snapshot' => 'array',
            'metadata' => 'array',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(MerchantPlatformSubscription::class, 'merchant_platform_subscription_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
