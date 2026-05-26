<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingZone extends Model
{
    protected $fillable = [
        'merchant_id',
        'shipping_profile_id',
        'merchant_location_id',
        'zone_name',
        'flat_rate_fee',
        'max_distance_km',
        'reference_lat',
        'reference_lng',
        'reference_name',
        'destination_region',
        'destination_city',
        'destination_country',
        'destination_country_id',
        'destination_state_id',
        'destination_city_id',
        'delivery_type',
        'coverage_scope',
        'is_active',
        'handling_min_days',
        'handling_max_days',
        'transit_min_days',
        'transit_max_days',
        'cutoff_time',
        'business_days_only',
        'delivery_promise_label',
        'delivery_promise_note',
        'requires_delivery_confirmation',
    ];

    protected function casts(): array
    {
        return [
            'flat_rate_fee' => 'decimal:2',
            'max_distance_km' => 'decimal:2',
            'reference_lat' => 'decimal:8',
            'reference_lng' => 'decimal:8',
            'is_active' => 'boolean',
            'handling_min_days' => 'integer',
            'handling_max_days' => 'integer',
            'transit_min_days' => 'integer',
            'transit_max_days' => 'integer',
            'business_days_only' => 'boolean',
            'requires_delivery_confirmation' => 'boolean',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(ShippingProfile::class, 'shipping_profile_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'merchant_location_id');
    }

    public function destinationCountryRecord(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'destination_country_id');
    }

    public function destinationStateRecord(): BelongsTo
    {
        return $this->belongsTo(CountryState::class, 'destination_state_id');
    }

    public function destinationCityRecord(): BelongsTo
    {
        return $this->belongsTo(CountryCity::class, 'destination_city_id');
    }

    /**
     * Calculate distance between two points in KM using Haversine formula.
     */
    public static function calculateDistance($lat1, $lon1, $lat2, $lon2): float
    {
        $earthRadius = 6371; // km

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    public function oneClickProfiles(): HasMany
    {
        return $this->hasMany(OneClickProfile::class, 'delivery_zone_id');
    }

    public function hotspots(): HasMany
    {
        return $this->hasMany(ShippingHotspot::class);
    }
}
