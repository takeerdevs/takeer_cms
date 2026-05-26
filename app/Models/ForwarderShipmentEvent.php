<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForwarderShipmentEvent extends Model
{
    protected $fillable = [
        'forwarder_shipment_id',
        'actor_user_id',
        'forwarder_location_id',
        'status',
        'note',
        'attachments',
        'metadata',
    ];

    protected $casts = [
        'attachments' => 'array',
        'metadata' => 'array',
    ];

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(ForwarderShipment::class, 'forwarder_shipment_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(ForwarderLocation::class, 'forwarder_location_id');
    }
}
