<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductCustomizationOption extends Model
{
    protected $fillable = [
        'product_id', 'merchant_id', 'name', 'description', 'min_order_quantity',
        'fee_type', 'fee_amount', 'currency', 'image_url', 'notes', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'min_order_quantity' => 'decimal:3',
            'fee_amount' => 'decimal:2',
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
