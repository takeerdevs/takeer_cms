<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiderWaitlistEntry extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'phone_normalized',
        'city',
        'main_station',
        'vehicle_type',
        'source_delivery_id',
        'source_order_id',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function sourceDelivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class, 'source_delivery_id');
    }

    public function sourceOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'source_order_id');
    }
}
