<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductCategoryAttributeValue extends Model
{
    protected $fillable = [
        'product_id',
        'category_attribute_id',
        'value_text',
        'value_number',
        'value_boolean',
        'value_json',
        'source',
        'confidence',
        'is_verified',
    ];

    protected function casts(): array
    {
        return [
            'product_id' => 'integer',
            'category_attribute_id' => 'integer',
            'value_number' => 'decimal:4',
            'value_boolean' => 'boolean',
            'value_json' => 'array',
            'confidence' => 'decimal:3',
            'is_verified' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function categoryAttribute(): BelongsTo
    {
        return $this->belongsTo(ProductCategoryAttribute::class, 'category_attribute_id');
    }
}
