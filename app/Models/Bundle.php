<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bundle extends Model
{
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    protected $fillable = [
        'merchant_id',
        'title',
        'slug',
        'description',
        'price',
        'currency_id',
        'is_individual_sale',
        'is_course',
        'course_format',
        'course_outcomes',
        'course_requirements',
        'course_cover_image_url',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_individual_sale' => 'boolean',
            'is_course' => 'boolean',
            'course_outcomes' => 'array',
            'course_requirements' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BundleItem::class)->orderBy('sort_order');
    }

    public function courseModules(): HasMany
    {
        return $this->hasMany(BundleCourseModule::class)->orderBy('sort_order');
    }

    public function cohorts(): HasMany
    {
        return $this->hasMany(BundleCohort::class)->orderBy('starts_at');
    }

    public function planItems(): HasMany
    {
        return $this->hasMany(SubscriptionPlanItem::class, 'item_id')->where('item_type', 'bundle');
    }
}
