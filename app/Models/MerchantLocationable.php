<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class MerchantLocationable extends Model
{
    protected $fillable = [
        'merchant_id',
        'merchant_location_id',
        'locationable_type',
        'locationable_id',
        'availability_type',
        'is_enabled',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'merchant_id' => 'integer',
            'merchant_location_id' => 'integer',
            'locationable_id' => 'integer',
            'is_enabled' => 'boolean',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'merchant_location_id');
    }

    public function locationable(): MorphTo
    {
        return $this->morphTo();
    }
}
