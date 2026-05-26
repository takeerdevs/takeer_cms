<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ForwarderShipment extends Model
{
    public const STATUS_INCOMING = 'incoming';

    protected $fillable = [
        'public_id',
        'user_id',
        'forwarder_id',
        'forwarder_route_id',
        'transport_mode',
        'origin_location_id',
        'destination_location_id',
        'user_address_id',
        'order_id',
        'source_type',
        'status',
        'seller_name',
        'seller_platform',
        'external_order_ref',
        'tracking_number',
        'package_description',
        'package_count',
        'weight_estimate',
        'required_field_values',
        'attachments',
        'address_snapshot',
        'route_snapshot',
        'metadata',
        'last_status_at',
    ];

    protected $casts = [
        'required_field_values' => 'array',
        'attachments' => 'array',
        'address_snapshot' => 'array',
        'route_snapshot' => 'array',
        'metadata' => 'array',
        'last_status_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (ForwarderShipment $shipment): void {
            $shipment->public_id ??= 'FS-' . now()->format('ymd') . '-' . Str::upper(Str::random(6));
            $shipment->last_status_at ??= now();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function forwarder(): BelongsTo
    {
        return $this->belongsTo(Forwarder::class);
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(ForwarderRoute::class, 'forwarder_route_id');
    }

    public function originLocation(): BelongsTo
    {
        return $this->belongsTo(ForwarderLocation::class, 'origin_location_id');
    }

    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(ForwarderLocation::class, 'destination_location_id');
    }

    public function userAddress(): BelongsTo
    {
        return $this->belongsTo(UserAddress::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ForwarderShipmentEvent::class);
    }
}
