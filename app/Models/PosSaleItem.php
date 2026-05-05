<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosSaleItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'product_variant_id',
        'location_id',
        'quantity',
        'quantity_decimal',
        'unit_price',
        'price_at_sale',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'quantity_decimal' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'price_at_sale' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'location_id');
    }
}
