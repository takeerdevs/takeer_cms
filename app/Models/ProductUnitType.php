<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProductUnitType extends Model
{
    protected $fillable = [
        'name',
        'code',
        'symbol',
        'unit_category',
        'base_unit_code',
        'conversion_factor_to_base',
        'allows_decimal',
        'localized_labels',
        'common_quantities',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'conversion_factor_to_base' => 'decimal:6',
            'allows_decimal' => 'boolean',
            'localized_labels' => 'array',
            'common_quantities' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(ProductCategory::class, 'product_category_unit_type', 'unit_type_id', 'category_id')
            ->withPivot(['is_default', 'min_order_quantity', 'order_increment'])
            ->withTimestamps();
    }
}
