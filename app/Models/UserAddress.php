<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAddress extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'type',
        'address_line',
        'extra_details',
        'country_id',
        'state_id',
        'city_id',
        'latitude',
        'longitude',
        'is_default',
        'forwarder_id',
        'forwarder_route_id',
        'forwarder_location_id',
        'forwarder_transport_mode',
        'forwarder_customer_id',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'is_default' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function forwarder(): BelongsTo
    {
        return $this->belongsTo(Forwarder::class);
    }

    public function forwarderRoute(): BelongsTo
    {
        return $this->belongsTo(ForwarderRoute::class);
    }

    public function forwarderLocation(): BelongsTo
    {
        return $this->belongsTo(ForwarderLocation::class);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function state(): BelongsTo
    {
        return $this->belongsTo(CountryState::class, 'state_id');
    }

    public function cityRecord(): BelongsTo
    {
        return $this->belongsTo(CountryCity::class, 'city_id');
    }
}
