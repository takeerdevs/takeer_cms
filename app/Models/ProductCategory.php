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
        'localized_labels',
        'slug',
        'image_url',
        'risk_level',
        'allowed_fulfillment_modes',
        'requires_verified_business',
        'requires_manual_review',
        'required_documents',
        'payout_hold_days',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'localized_labels' => 'array',
            'allowed_fulfillment_modes' => 'array',
            'requires_verified_business' => 'boolean',
            'requires_manual_review' => 'boolean',
            'required_documents' => 'array',
            'payout_hold_days' => 'integer',
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

    public function unitTypes(): BelongsToMany
    {
        return $this->belongsToMany(ProductUnitType::class, 'product_category_unit_type', 'category_id', 'unit_type_id')
            ->withPivot(['is_default', 'min_order_quantity', 'order_increment'])
            ->withTimestamps()
            ->orderBy('unit_category')
            ->orderBy('sort_order')
            ->orderBy('name');
    }
}
