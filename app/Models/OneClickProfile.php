<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OneClickProfile extends Model
{
    protected $fillable = [
        'user_id',
        'payment_provider',
        'payment_number',
        'delivery_zone_id',
        'delivery_landmark',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:8',
            'longitude' => 'decimal:8',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deliveryZone(): BelongsTo
    {
        return $this->belongsTo(ShippingZone::class, 'delivery_zone_id');
    }
}
