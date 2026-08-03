<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProviderRefund extends Model
{
    protected $fillable = [
        'public_id', 'order_settlement_id', 'payment_provider_id', 'provider_transaction_reference', 'amount_minor',
        'currency', 'reason_code', 'state', 'requested_by_type', 'requested_by_id', 'provider_refund_reference',
        'provider_idempotency_key', 'requested_at', 'completed_at', 'failed_at', 'last_provider_event_id', 'metadata',
    ];

    protected function casts(): array
    {
        return ['requested_at' => 'datetime', 'completed_at' => 'datetime', 'failed_at' => 'datetime', 'metadata' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (ProviderRefund $refund): void { $refund->public_id ??= (string) Str::uuid(); });
    }

    public function settlement(): BelongsTo { return $this->belongsTo(OrderSettlement::class, 'order_settlement_id'); }
    public function provider(): BelongsTo { return $this->belongsTo(PaymentProvider::class, 'payment_provider_id'); }
    public function lastProviderEvent(): BelongsTo { return $this->belongsTo(ProviderEvent::class, 'last_provider_event_id'); }
}
