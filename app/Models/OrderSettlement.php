<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderSettlement extends Model
{
    protected $fillable = [
        'order_id', 'merchant_id', 'payment_provider_id', 'payment_attempt_id', 'currency',
        'buyer_paid_amount_minor', 'seller_amount_minor', 'takeer_fee_amount_minor', 'provider_fee_amount_minor',
        'tax_amount_minor', 'refunded_amount_minor', 'payout_eligible_amount_minor', 'paid_out_amount_minor',
        'settlement_state', 'hold_reason', 'release_rule_snapshot', 'release_eligible_at',
        'release_requested_at', 'refund_requested_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'release_rule_snapshot' => 'array',
            'release_eligible_at' => 'datetime',
            'release_requested_at' => 'datetime',
            'refund_requested_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function merchant(): BelongsTo { return $this->belongsTo(Merchant::class); }
    public function provider(): BelongsTo { return $this->belongsTo(PaymentProvider::class, 'payment_provider_id'); }
    public function paymentAttempt(): BelongsTo { return $this->belongsTo(PaymentAttempt::class); }
    public function transitions(): HasMany { return $this->hasMany(SettlementTransition::class); }
    public function payoutAllocation(): HasMany { return $this->hasMany(ProviderPayoutAllocation::class); }
    public function refunds(): HasMany { return $this->hasMany(ProviderRefund::class); }
}
