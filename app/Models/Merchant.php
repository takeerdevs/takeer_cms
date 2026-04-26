<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\MerchantStorefrontSetting;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Merchant extends Model
{
    use HasFactory;

    public function getRouteKeyName(): string
    {
        return 'username';
    }

    protected $appends = ['storage_used_mb', 'storage_percentage'];

    protected $fillable = [

        'user_id',
        'username',
        'display_name',
        'avatar_url',
        'bio',
        'type', // 'personal', 'business'
        'is_default',
        'successful_sales',
        'unsuccessful_sales',
        'country_id',
        'currency_id',
        'is_suspended',
        'is_verified',
        'is_active',
        'kyc_status',
        'subaccount_id',
        'storage_limit_mb',
        'storage_used_bytes',
        'subscription_tier',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_suspended' => 'boolean',
            'is_verified' => 'boolean',
            'storage_limit_mb' => 'integer',
            'storage_used_bytes' => 'integer',
        ];
    }

    public function getStorageUsedMbAttribute(): float
    {
        return round($this->storage_used_bytes / (1024 * 1024), 2);
    }

    public function getStoragePercentageAttribute(): float
    {
        if ($this->storage_limit_mb <= 0) return 100;
        return min(100, round(($this->storage_used_mb / $this->storage_limit_mb) * 100, 2));
    }

    /**
     * Get the user that owns the merchant profile.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the posts for the merchant profile.
     */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class, 'merchant_id');
    }

    /**
     * Get the products for the merchant profile.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'merchant_id');
    }

    public function contentItems(): HasMany
    {
        return $this->hasMany(ContentItem::class, 'merchant_id');
    }

    public function bundles(): HasMany
    {
        return $this->hasMany(Bundle::class, 'merchant_id');
    }

    public function subscriptionPlans(): HasMany
    {
        return $this->hasMany(SubscriptionPlan::class, 'merchant_id');
    }

    public function userSubscriptions(): HasMany
    {
        return $this->hasMany(UserSubscription::class, 'merchant_id');
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(Entitlement::class, 'merchant_id');
    }

    public function storefrontSetting(): HasOne
    {
        return $this->hasOne(MerchantStorefrontSetting::class, 'merchant_profile_id');
    }

    public function kyc(): HasOne
    {
        return $this->hasOne(MerchantKyc::class);
    }

    public function paymentPages(): HasMany
    {
        return $this->hasMany(PaymentPage::class);
    }

    public function locations(): HasMany
    {
        return $this->hasMany(MerchantLocation::class, 'merchant_id');
    }

    public function shippingProfiles(): HasMany
    {
        return $this->hasMany(ShippingProfile::class, 'merchant_id');
    }

    public function getDefaultShippingProfile(): ShippingProfile
    {
        return $this->shippingProfiles()->where('is_default', true)->first()
            ?? $this->shippingProfiles()->first()
            ?? $this->shippingProfiles()->create(['name' => 'General Shipping', 'is_default' => true]);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id');
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'merchant_id');
    }
}
