<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductCategory extends Model
{
    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'image_url',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ProductCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(ProductCategory::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function attributes(): HasMany
    {
        return $this->hasMany(ProductCategoryAttribute::class, 'category_id')->orderBy('sort_order')->orderBy('label');
    }

    public function brands(): BelongsToMany
    {
        return $this->belongsToMany(ProductBrand::class, 'product_category_brands', 'category_id', 'brand_id')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function brandModels(): BelongsToMany
    {
        return $this->belongsToMany(ProductBrandModel::class, 'product_category_brand_models', 'category_id', 'model_id')
            ->withPivot('brand_id')
            ->withTimestamps()
            ->orderBy('name');
    }
}
