<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantLocation extends Model
{
    protected $fillable = [
        'merchant_id',
        'name',
        'address',
        'latitude',
        'longitude',
        'place_id',
        'country_id',
        'state_id',
        'city_id',
        'city',
        'region',
        'is_primary',
        'allow_self_pickup',
        'contact_phone',
        'type',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:8',
            'longitude' => 'decimal:8',
            'is_primary' => 'boolean',
            'allow_self_pickup' => 'boolean',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
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

    public function shippingZones(): HasMany
    {
        return $this->hasMany(ShippingZone::class, 'merchant_location_id');
    }

    /**
     * Get the inventory levels for products at this location.
     */
    public function productInventories(): HasMany
    {
        return $this->hasMany(ProductLocationInventory::class, 'merchant_location_id');
    }

    public function locationables(): HasMany
    {
        return $this->hasMany(MerchantLocationable::class, 'merchant_location_id');
    }

    public function staff(): HasMany
    {
        return $this->hasMany(MerchantStaff::class, 'assigned_location_id');
    }

    public function stockTransfersFrom(): HasMany
    {
        return $this->hasMany(StockTransfer::class, 'from_location_id');
    }

    public function stockTransfersTo(): HasMany
    {
        return $this->hasMany(StockTransfer::class, 'to_location_id');
    }
}
