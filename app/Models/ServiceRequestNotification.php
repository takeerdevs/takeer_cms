<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceRequestNotification extends Model
{
    protected $fillable = [
        'service_request_id',
        'channel',
        'recipient',
        'subject',
        'message',
        'status',
        'provider',
        'provider_message_id',
        'error_message',
        'metadata',
        'prepared_at',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'prepared_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }
}
