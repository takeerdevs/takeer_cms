<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductPackagingDetail extends Model
{
    protected $fillable = [
        'product_id', 'merchant_id', 'selling_units', 'package_quantity', 'package_unit',
        'package_weight_kg', 'package_length_cm', 'package_width_cm', 'package_height_cm',
        'notes', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'package_quantity' => 'decimal:3',
            'package_weight_kg' => 'decimal:3',
            'package_length_cm' => 'decimal:2',
            'package_width_cm' => 'decimal:2',
            'package_height_cm' => 'decimal:2',
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
