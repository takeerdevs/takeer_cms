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
    ];

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
