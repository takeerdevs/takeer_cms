<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShippingProfile extends Model
{
    protected $fillable = [
        'merchant_id',
        'name',
        'is_default',
        'outside_area_policy',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function blocksOutsideAreas(): bool
    {
        return ($this->outside_area_policy ?: 'inquiry') === 'block';
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
    }

    public function rates(): HasMany
    {
        return $this->hasMany(ShippingZone::class, 'shipping_profile_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'shipping_profile_id');
    }
}
