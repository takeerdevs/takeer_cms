<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductAttribute extends Model
{
    protected $fillable = [
        'product_id',
        'category_id',
        'sub_category_id',
        'brand_id',
        'model_id',
        'category',
        'sub_category',
        'colors',
        'material',
        'style',
        'detected_gender',
        'suggested_description',
        'ai_extracted',
    ];

    protected function casts(): array
    {
        return [
            'colors' => 'array',
            'category_id' => 'integer',
            'sub_category_id' => 'integer',
            'brand_id' => 'integer',
            'model_id' => 'integer',
            'ai_extracted' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function categoryRelation(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'category_id');
    }

    public function subCategoryRelation(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'sub_category_id');
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(ProductBrand::class, 'brand_id');
    }

    public function model(): BelongsTo
    {
        return $this->belongsTo(ProductBrandModel::class, 'model_id');
    }
}
