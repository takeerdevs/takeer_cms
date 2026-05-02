<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

use App\Traits\InteractsWithImpressions;

class Product extends Model
{
    use InteractsWithImpressions;
    /**
     * Get the route key for the model.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    protected $fillable = [
        'type',
        'merchant_id',
        'title',
        'has_variants',
        'price',
        'compare_at_price',
        'discounted_price',
        'inventory_count',
        'buffer_stock',
        'slug',
        'url',
        'download_link',
        'service_pricing_model',
        'service_booking_type',
        'service_hourly_rate',
        'service_min_hours',
        'service_deposit_amount',
        'service_is_showcase',
        'service_mode',
        'service_scheduling_type',
        'service_category',
        'service_subcategory',
        'service_price_display',
        'service_charges',
        'service_options',
        'service_duration_minutes',
        'service_location_type',
        'service_provider_location',
        'service_area',
        'service_client_requirements',
        'service_intake_form',
        'service_booking_provider',
        'service_contact_channel',
        'service_contact_value',
        'shipping_profile_id',
        'views_count',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'has_variants' => 'boolean',
            'compare_at_price' => 'decimal:2',
            'discounted_price' => 'decimal:2',
            'inventory_count' => 'integer',
            'buffer_stock' => 'integer',
            'service_hourly_rate' => 'decimal:2',
            'service_min_hours' => 'integer',
            'service_deposit_amount' => 'decimal:2',
            'service_is_showcase' => 'boolean',
            'service_charges' => 'array',
            'service_options' => 'array',
            'service_duration_minutes' => 'integer',
            'service_provider_location' => 'array',
            'service_area' => 'array',
            'service_intake_form' => 'array',
        ];
    }

    protected $appends = ['available_stock', 'image_url', 'description'];

    public function getImageUrlAttribute(): ?string
    {
        $media = $this->images->first();
        $fallbackImage = $this->images->first(fn ($item) => ($item->media_type ?: 'image') === 'image');

        return $media?->thumbnail_url
            ?? $fallbackImage?->image_url
            ?? (((string) ($this->url ?? '') !== '' && !preg_match('/\.(mp4|mov|webm|ogg)(\?|$)/i', (string) $this->url)) ? $this->url : null)
            ?? $this->download_link;
    }

    public function getUrlAttribute(): ?string
    {
        return $this->attributes['url'] ?? $this->attributes['download_link'] ?? null;
    }

    public function setUrlAttribute(?string $value): void
    {
        $this->attributes['url'] = $value;
    }

    public function getDescriptionAttribute(): ?string
    {
        $attributesRelation = $this->getRelationValue('attributes');
        return $attributesRelation?->suggested_description;
    }

    // ─── Relationships ──────────────────────────────────────────────────────────

    /**
     * Get the owner of the product.
     */
    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
    }

    public function shippingProfile(): BelongsTo
    {
        return $this->belongsTo(ShippingProfile::class, 'shipping_profile_id');
    }

    public function attributes(): HasOne
    {
        return $this->hasOne(ProductAttribute::class);
    }

    public function embedding(): HasOne
    {
        return $this->hasOne(ProductEmbedding::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('order');
    }

    public function postTags(): HasMany
    {
        return $this->hasMany(PostProductTag::class);
    }

    public function categoryAttributeValues(): HasMany
    {
        return $this->hasMany(ProductCategoryAttributeValue::class)->with('categoryAttribute:id,category_id,key,label,input_type,options,is_required,is_filterable,is_variant_axis,ai_extractable,sort_order');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function serviceRequests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class);
    }

    public function serviceAvailabilityRules(): HasMany
    {
        return $this->hasMany(ServiceAvailabilityRule::class);
    }

    public function serviceSessions(): HasMany
    {
        return $this->hasMany(ServiceSession::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('sort_order')->orderBy('name');
    }

    /**
     * Get the inventory levels for this product across all locations.
     */
    public function locationInventories(): HasMany
    {
        return $this->hasMany(ProductLocationInventory::class);
    }

    public function waitlists(): HasMany
    {
        return $this->hasMany(StockWaitlist::class);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /** Returns publicly visible stock (inventory minus buffer). */
    public function getAvailableStockAttribute(): int
    {
        if ($this->has_variants) {
            $variantStock = $this->relationLoaded('variants')
                ? (int) $this->variants->where('is_active', true)->sum('inventory_count')
                : (int) $this->variants()->where('is_active', true)->sum('inventory_count');

            return max(0, $variantStock - $this->buffer_stock);
        }

        return max(0, $this->inventory_count - $this->buffer_stock);
    }

    public function isInStock(): bool
    {
        // Digital and Service products are never out of stock
        if ($this->type === 'digital' || $this->type === 'service') {
            return true;
        }

        return $this->available_stock > 0;
    }

    public function isPhysical(): bool
    {
        return $this->type === 'physical';
    }

    public function isDigital(): bool
    {
        return $this->type === 'digital';
    }

    public function isService(): bool
    {
        return $this->type === 'service';
    }

    public function course(): HasOne
    {
        return $this->hasOne(Course::class);
    }
}
