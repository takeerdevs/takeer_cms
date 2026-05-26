<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ForwarderRoute extends Model
{
    protected $fillable = [
        'forwarder_id',
        'route_uid',
        'origin_country_id',
        'destination_country_id',
        'estimate',
        'rates_info',
        'customer_instructions',
        'post_to_feed',
        'feed_post_id',
        'posted_at',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'post_to_feed' => 'boolean',
        'is_active' => 'boolean',
        'posted_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function forwarder(): BelongsTo
    {
        return $this->belongsTo(Forwarder::class);
    }

    public function originCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'origin_country_id');
    }

    public function destinationCountry(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'destination_country_id');
    }

    public function routeLocations(): HasMany
    {
        return $this->hasMany(ForwarderRouteLocation::class);
    }

    public function transportModes(): HasMany
    {
        return $this->hasMany(ForwarderRouteTransportMode::class);
    }

    public function originLocations(): BelongsToMany
    {
        return $this->belongsToMany(ForwarderLocation::class, 'forwarder_route_locations')
            ->wherePivot('role', 'origin')
            ->withTimestamps();
    }

    public function destinationLocations(): BelongsToMany
    {
        return $this->belongsToMany(ForwarderLocation::class, 'forwarder_route_locations')
            ->wherePivot('role', 'destination')
            ->withTimestamps();
    }
}
