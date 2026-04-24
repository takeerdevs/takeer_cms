<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id',
        'name',
        'sku',
        'price',
        'compare_at_price',
        'inventory_count',
        'attributes',
        'swatch_image_url',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'product_id' => 'integer',
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'inventory_count' => 'integer',
            'attributes' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * Get the inventory levels for this variant across all locations.
     */
    public function locationInventories(): HasMany
    {
        return $this->hasMany(ProductLocationInventory::class, 'product_variant_id');
    }

    public function waitlists(): HasMany
    {
        return $this->hasMany(StockWaitlist::class, 'variant_id');
    }
}

