<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PaymentAttempt extends Model
{
    protected $fillable = [
        'public_id', 'order_id', 'payment_provider_id', 'payment_provider_channel_id', 'provider_merchant_id',
        'takeer_reference', 'expected_amount_minor', 'expected_currency', 'expected_country_code',
        'payment_phone_encrypted', 'payment_phone_hash', 'state', 'idempotency_key',
        'provider_request_reference', 'provider_transaction_reference', 'request_snapshot', 'response_snapshot',
        'initiated_at', 'expires_at', 'confirmed_at', 'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'payment_phone_encrypted' => 'encrypted',
            'request_snapshot' => 'array',
            'response_snapshot' => 'array',
            'initiated_at' => 'datetime',
            'expires_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PaymentAttempt $attempt): void {
            $attempt->public_id ??= (string) Str::uuid();
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(PaymentProviderChannel::class, 'payment_provider_channel_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ProviderEvent::class, 'takeer_reference', 'takeer_reference');
    }

    public function amount(): float
    {
        return $this->expected_amount_minor / 100;
    }
}
