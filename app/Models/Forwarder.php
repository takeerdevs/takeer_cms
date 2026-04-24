<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Forwarder extends Model
{
    protected $fillable = [
        'name',
        'address_line',
        'latitude',
        'longitude',
        'contact_phone',
        'website',
        'is_verified',
        'required_fields',
        'country_id',
        'rates_info',
        'description',
        'logo_url',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'is_verified' => 'boolean',
        'required_fields' => 'array',
    ];

    public function country(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function userAddresses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(UserAddress::class);
    }
}
