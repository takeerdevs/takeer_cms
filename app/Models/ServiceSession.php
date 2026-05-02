<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceSession extends Model
{
    protected $fillable = [
        'merchant_id',
        'product_id',
        'title',
        'starts_at',
        'ends_at',
        'timezone',
        'location_type',
        'location_text',
        'capacity',
        'price_override',
        'registration_deadline',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'capacity' => 'integer',
            'price_override' => 'decimal:2',
            'registration_deadline' => 'datetime',
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
