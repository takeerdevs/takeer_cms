<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForwarderLocation extends Model
{
    protected $fillable = [
        'forwarder_id',
        'roles',
        'name',
        'address_line',
        'address_template',
        'country_id',
        'state_id',
        'city_id',
        'latitude',
        'longitude',
        'contact_phone',
        'contact_person',
        'business_hours',
        'merchant_instructions',
        'customer_instructions',
        'required_fields',
        'is_verified',
        'is_active',
        'verified_at',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'roles' => 'array',
        'required_fields' => 'array',
        'is_verified' => 'boolean',
        'is_active' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function forwarder(): BelongsTo
    {
        return $this->belongsTo(Forwarder::class);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function state(): BelongsTo
    {
        return $this->belongsTo(CountryState::class);
    }

    public function cityRecord(): BelongsTo
    {
        return $this->belongsTo(CountryCity::class, 'city_id');
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles ?: [], true);
    }
}
