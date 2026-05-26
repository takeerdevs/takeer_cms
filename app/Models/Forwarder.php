<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Forwarder extends Model
{
    protected $fillable = [
        'merchant_id',
        'product_id',
        'name',
        'legal_name',
        'business_registration_number',
        'address_line',
        'latitude',
        'longitude',
        'contact_phone',
        'contact_person',
        'contact_email',
        'whatsapp_phone',
        'website',
        'is_verified',
        'verification_status',
        'required_fields',
        'service_types',
        'origin_country_ids',
        'destination_country_ids',
        'documents',
        'admin_notes',
        'submitted_by_user_id',
        'verified_at',
        'country_id',
        'rates_info',
        'description',
        'application_summary',
        'logo_url',
        'operating_country_ids',
        'application_submitted_at',
        'destinations_config',
        'shipping_schedules',
        'logistics_updates',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'is_verified' => 'boolean',
        'required_fields' => 'array',
        'service_types' => 'array',
        'origin_country_ids' => 'array',
        'destination_country_ids' => 'array',
        'operating_country_ids' => 'array',
        'documents' => 'array',
        'destinations_config' => 'array',
        'shipping_schedules' => 'array',
        'logistics_updates' => 'array',
        'application_submitted_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function country(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function merchant(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function userAddresses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(UserAddress::class);
    }

    public function locations(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ForwarderLocation::class);
    }

    public function routes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ForwarderRoute::class);
    }

    public function shipments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ForwarderShipment::class);
    }

    public function originLocations(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->locations()->whereJsonContains('roles', 'origin');
    }

    public function destinationLocations(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->locations()->whereJsonContains('roles', 'destination');
    }

    public function submitter(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }
}
