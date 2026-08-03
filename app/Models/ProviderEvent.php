<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ProviderEvent extends Model
{
    protected $fillable = [
        'public_id', 'payment_provider_id', 'direction', 'event_type', 'provider_event_id',
        'provider_transaction_reference', 'takeer_reference', 'received_at', 'source_ip',
        'raw_body_encrypted', 'raw_body_sha256', 'filtered_headers', 'signature_present', 'signature_valid',
        'replay_key', 'amount_minor', 'currency', 'validation_state', 'validation_errors',
        'processed_at', 'processing_result', 'related_type', 'related_id',
    ];

    protected function casts(): array
    {
        return [
            'raw_body_encrypted' => 'encrypted',
            'filtered_headers' => 'array',
            'signature_present' => 'boolean',
            'signature_valid' => 'boolean',
            'validation_errors' => 'array',
            'received_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ProviderEvent $event): void {
            $event->public_id ??= (string) Str::uuid();
        });

        static::deleting(function (): never {
            throw new \LogicException('Provider events are append-only and cannot be deleted.');
        });
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }
}
