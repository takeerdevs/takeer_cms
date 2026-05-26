<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForwarderRouteLocation extends Model
{
    protected $fillable = [
        'forwarder_route_id',
        'forwarder_location_id',
        'role',
    ];

    public function route(): BelongsTo
    {
        return $this->belongsTo(ForwarderRoute::class, 'forwarder_route_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(ForwarderLocation::class, 'forwarder_location_id');
    }
}
