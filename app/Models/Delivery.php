<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'delivery_person_name',
        'bus_company',
        'waybill_tracking_number',
        'waybill_photo_url',
        'delivery_type',
        'delivery_status',
        'delivered_at',
        'confirmed_at',
        'buyer_release_pin',
        'pickup_pin',
        'whatsapp_pin_url',
        'buyer_unboxing_video_url',
        'rider_access_token_hash',
        'rider_access_expires_at',
        'rider_access_revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'delivered_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'rider_access_expires_at' => 'datetime',
            'rider_access_revoked_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Delivery $delivery): void {
            if ($delivery->isDirty('delivery_status') && in_array($delivery->delivery_status, ['delivered', 'customer_confirmed'], true)) {
                $delivery->delivered_at ??= now();
            }

            if ($delivery->isDirty('delivery_status') && $delivery->delivery_status === 'customer_confirmed') {
                $delivery->confirmed_at ??= now();
            }
        });

        static::updated(function (Delivery $delivery): void {
            app(\App\Services\PulseNotificationService::class)->deliveryUpdated($delivery);
        });
    }

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

    public function events(): HasMany
    {
        return $this->hasMany(DeliveryEvent::class)->latest();
    }
}
