<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductCategoryAttribute extends Model
{
    protected $fillable = [
        'category_id',
        'key',
        'label',
        'input_type',
        'ui_hint',
        'options',
        'unit_options',
        'is_required',
        'is_filterable',
        'is_variant_axis',
        'ai_extractable',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'category_id' => 'integer',
            'options' => 'array',
            'unit_options' => 'array',
            'is_required' => 'boolean',
            'is_filterable' => 'boolean',
            'is_variant_axis' => 'boolean',
            'ai_extractable' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function values(): HasMany
    {
        return $this->hasMany(ProductCategoryAttributeValue::class, 'category_attribute_id');
    }
}
