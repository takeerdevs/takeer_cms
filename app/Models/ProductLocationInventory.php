<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductLocationInventory extends Model
{
    protected $fillable = [
        'merchant_location_id',
        'product_id',
        'product_variant_id',
        'quantity',
        'quantity_decimal',
    ];

    protected function casts(): array
    {
        return [
            'merchant_location_id' => 'integer',
            'product_id' => 'integer',
            'product_variant_id' => 'integer',
            'quantity' => 'integer',
            'quantity_decimal' => 'decimal:3',
        ];
    }

    /**
     * Get the merchant location that owns the inventory.
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'merchant_location_id');
    }

    /**
     * Get the product associated with this inventory.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the variant associated with this inventory.
     */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
