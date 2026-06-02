<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductSpecification extends Model
{
    protected $fillable = ['product_id', 'merchant_id', 'group_name', 'attribute_name', 'attribute_value', 'is_filterable', 'sort_order'];

    protected function casts(): array
    {
        return [
            'is_filterable' => 'boolean',
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
