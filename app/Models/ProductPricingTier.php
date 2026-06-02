<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPricingTier extends Model
{
    protected $fillable = ['product_id', 'merchant_id', 'min_quantity', 'max_quantity', 'unit_price', 'currency', 'label', 'sort_order'];

    protected function casts(): array
    {
        return [
            'min_quantity' => 'decimal:3',
            'max_quantity' => 'decimal:3',
            'unit_price' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
