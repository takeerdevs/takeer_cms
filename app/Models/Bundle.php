<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Bundle extends Model
{
    use SoftDeletes;

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    protected $fillable = [
        'merchant_id',
        'shipping_profile_id',
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
        'delivery_promise_override_enabled',
        'delivery_handling_min_days',
        'delivery_handling_max_days',
        'delivery_transit_min_days',
        'delivery_transit_max_days',
        'delivery_cutoff_time',
        'delivery_business_days_only',
        'delivery_promise_label',
        'delivery_promise_note',
        'delivery_requires_confirmation',
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
            'shipping_profile_id' => 'integer',
            'delivery_promise_override_enabled' => 'boolean',
            'delivery_handling_min_days' => 'integer',
            'delivery_handling_max_days' => 'integer',
            'delivery_transit_min_days' => 'integer',
            'delivery_transit_max_days' => 'integer',
            'delivery_business_days_only' => 'boolean',
            'delivery_requires_confirmation' => 'boolean',
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
