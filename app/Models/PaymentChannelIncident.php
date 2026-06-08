<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentChannelIncident extends Model
{
    protected $fillable = [
        'payment_provider_channel_id',
        'severity',
        'status',
        'title',
        'message',
        'started_at',
        'resolved_at',
        'notified_merchant_ids',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'resolved_at' => 'datetime',
            'notified_merchant_ids' => 'array',
            'metadata' => 'array',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(PaymentProviderChannel::class, 'payment_provider_channel_id');
    }
}
