<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\MerchantStorefrontSetting;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Merchant extends Model
{
    use HasFactory;

    public function getRouteKeyName(): string
    {
        return 'username';
    }

    protected $fillable = [

        'user_id',
        'username',
        'display_name',
        'avatar_url',
        'bio',
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
    ];

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

    public function storefrontSetting()
    {
        return $this->hasOne(MerchantStorefrontSetting::class, 'merchant_profile_id');
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
