<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceAvailabilityRule extends Model
{
    protected $fillable = [
        'merchant_id',
        'product_id',
        'timezone',
        'weekday',
        'start_time',
        'end_time',
        'slot_interval_minutes',
        'buffer_minutes',
        'capacity',
        'is_active',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'weekday' => 'integer',
            'slot_interval_minutes' => 'integer',
            'buffer_minutes' => 'integer',
            'capacity' => 'integer',
            'is_active' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
