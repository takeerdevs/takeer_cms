<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

use App\Traits\InteractsWithImpressions;

class Product extends Model
{
    use InteractsWithImpressions, SoftDeletes;
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
        'fulfillment_mode',
        'source_details',
        'availability_lead_time_days',
        'available_from',
        'group_sale_goal_quantity',
        'group_sale_deadline',
        'price',
        'compare_at_price',
        'discounted_price',
        'inventory_count',
        'buffer_stock',
        'slug',
        'url',
        'download_link',
        'digital_delivery_type',
        'digital_content_type',
        'digital_usage_license',
        'digital_access_instructions',
        'license_key_enabled',
        'license_key_prefix',
        'license_activation_limit',
        'paid_video_url',
        'paid_video_mime',
        'paid_video_size',
        'paid_video_duration_seconds',
        'premium_video_status',
        'premium_video_hls_path',
        'premium_video_hls_disk',
        'premium_video_thumbnail_path',
        'premium_video_error',
        'premium_video_processed_at',
        'paid_audio_url',
        'paid_audio_mime',
        'paid_audio_size',
        'paid_audio_duration_seconds',
        'paid_gallery_items',
        'allow_download',
        'refund_policy',
        'refund_window_days',
        'refund_policy_note',
        'live_event_starts_at',
        'live_event_duration_minutes',
        'live_event_timezone',
        'live_event_access_url',
        'live_event_venue',
        'live_event_capacity',
        'live_event_replay_url',
        'live_event_instructions',
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
        'service_related_product_ids',
        'service_booking_provider',
        'service_contact_channel',
        'service_contact_value',
        'shipping_profile_id',
        'product_unit_type_id',
        'sellable_quantity',
        'min_order_quantity',
        'order_increment',
        'inventory_quantity',
        'views_count',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'has_variants' => 'boolean',
            'source_details' => 'array',
            'availability_lead_time_days' => 'integer',
            'available_from' => 'date',
            'group_sale_goal_quantity' => 'integer',
            'group_sale_deadline' => 'date',
            'compare_at_price' => 'decimal:2',
            'discounted_price' => 'decimal:2',
            'inventory_count' => 'integer',
            'product_unit_type_id' => 'integer',
            'sellable_quantity' => 'decimal:3',
            'min_order_quantity' => 'decimal:3',
            'order_increment' => 'decimal:3',
            'inventory_quantity' => 'decimal:3',
            'buffer_stock' => 'integer',
            'paid_video_size' => 'integer',
            'paid_video_duration_seconds' => 'integer',
            'premium_video_processed_at' => 'datetime',
            'paid_audio_size' => 'integer',
            'paid_audio_duration_seconds' => 'integer',
            'paid_gallery_items' => 'array',
            'allow_download' => 'boolean',
            'refund_window_days' => 'integer',
            'live_event_starts_at' => 'datetime',
            'live_event_duration_minutes' => 'integer',
            'live_event_capacity' => 'integer',
            'license_key_enabled' => 'boolean',
            'license_activation_limit' => 'integer',
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
            'service_related_product_ids' => 'array',
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

    public function unitType(): BelongsTo
    {
        return $this->belongsTo(ProductUnitType::class, 'product_unit_type_id');
    }

    public function softwareReleases(): HasMany
    {
        return $this->hasMany(ProductRelease::class)->latest('published_at')->latest('id');
    }

    public function licenseKeys(): HasMany
    {
        return $this->hasMany(ProductLicenseKey::class);
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
        return $this->hasMany(ProductCategoryAttributeValue::class)->with('categoryAttribute:id,category_id,key,label,input_type,ui_hint,options,is_required,is_filterable,is_variant_axis,ai_extractable,sort_order');
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
    public function getAvailableStockAttribute(): float
    {
        if ($this->has_variants) {
            $variantStock = $this->relationLoaded('variants')
                ? (float) $this->variants->where('is_active', true)->sum(fn ($variant) => (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0))
                : (float) $this->variants()->where('is_active', true)->sum(DB::raw('COALESCE(inventory_quantity, inventory_count)'));

            return max(0, $variantStock - $this->buffer_stock);
        }

        return max(0, (float) ($this->inventory_quantity ?? $this->inventory_count ?? 0) - $this->buffer_stock);
    }

    public function isInStock(): bool
    {
        if ($this->type === 'digital' && ($this->digital_delivery_type ?? null) === 'live_event' && $this->live_event_capacity) {
            return $this->liveEventSeatsRemaining() > 0;
        }

        // Digital and Service products are never out of stock
        if ($this->type === 'digital' || $this->type === 'service') {
            return true;
        }

        return $this->available_stock > 0;
    }

    public function liveEventSeatsSold(): int
    {
        if (($this->digital_delivery_type ?? null) !== 'live_event') {
            return 0;
        }

        return (int) Order::query()
            ->where('product_id', $this->id)
            ->whereIn('payment_status', ['payment_initiated', 'escrow_locked', 'resolved_merchant_paid'])
            ->where(function ($query): void {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->sum('quantity');
    }

    public function liveEventSeatsRemaining(): ?int
    {
        if (($this->digital_delivery_type ?? null) !== 'live_event' || !$this->live_event_capacity) {
            return null;
        }

        return max(0, (int) $this->live_event_capacity - $this->liveEventSeatsSold());
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

}
