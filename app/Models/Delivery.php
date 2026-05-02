<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Delivery extends Model
{
    protected $fillable = [
        'order_id',
        'shipping_zone_id',
        'shipping_hotspot_id',
        'physical_address',
        'latitude',
        'longitude',
        'boda_phone',
        'bus_company',
        'waybill_tracking_number',
        'waybill_photo_url',
        'delivery_type',
        'delivery_status',
        'buyer_release_pin',
        'pickup_pin',
        'whatsapp_pin_url',
        'buyer_unboxing_video_url',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function shippingZone(): BelongsTo
    {
        return $this->belongsTo(ShippingZone::class);
    }

    public function hotspot(): BelongsTo
    {
        return $this->belongsTo(ShippingHotspot::class, 'shipping_hotspot_id');
    }
}
