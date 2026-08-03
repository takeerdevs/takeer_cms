<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ProviderPayout extends Model
{
    protected $fillable = [
        'public_id', 'merchant_id', 'payment_provider_id', 'seller_payment_profile_id', 'currency', 'amount_minor',
        'state', 'provider_payout_reference', 'provider_idempotency_key', 'due_at', 'submitted_at', 'completed_at',
        'failed_at', 'failure_code', 'failure_message', 'retry_count', 'next_retry_at', 'last_provider_event_id', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime', 'submitted_at' => 'datetime', 'completed_at' => 'datetime', 'failed_at' => 'datetime',
            'next_retry_at' => 'datetime', 'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProviderPayout $payout): void { $payout->public_id ??= (string) Str::uuid(); });
    }

    public function merchant(): BelongsTo { return $this->belongsTo(Merchant::class); }
    public function provider(): BelongsTo { return $this->belongsTo(PaymentProvider::class, 'payment_provider_id'); }
    public function sellerProfile(): BelongsTo { return $this->belongsTo(MarketplaceSellerPaymentProfile::class, 'seller_payment_profile_id'); }
    public function allocations(): HasMany { return $this->hasMany(ProviderPayoutAllocation::class); }
    public function lastProviderEvent(): BelongsTo { return $this->belongsTo(ProviderEvent::class, 'last_provider_event_id'); }
}
