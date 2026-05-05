<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingEvent extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'order_id',
        'session_id',
        'event_type',
        'entity_type',
        'entity_id',
        'source',
        'source_url',
        'landing_url',
        'referrer_url',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'merchant_referral_link_id',
        'referral_code',
        'coupon_code',
        'value',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'value' => 'decimal:2',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function referralLink(): BelongsTo
    {
        return $this->belongsTo(MerchantReferralLink::class, 'merchant_referral_link_id');
    }
}
