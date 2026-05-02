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
        'timezone',
        'is_suspended',
        'is_verified',
        'is_active',
        'kyc_status',
        'subaccount_id',
        'storage_limit_mb',
        'storage_used_bytes',
        'subscription_tier',
        'active_modules',
        'retail_settings',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_suspended' => 'boolean',
            'is_verified' => 'boolean',
            'storage_limit_mb' => 'integer',
            'storage_used_bytes' => 'integer',
            'active_modules' => 'array',
            'retail_settings' => 'array',
        ];
    }

    public function getRetailSettingsAttribute($value): array
    {
        $defaults = [
            'max_no_pin_discount_percent' => 5,
            'require_pin_for_partial_payment' => true,
            'allow_remote_approval' => true,
            'allow_online_reservation' => false,
            'reservation_max_hours' => 24,
            'shop_routes' => [],
        ];

        if (!$value) return $defaults;

        return array_merge($defaults, json_decode($value, true) ?: []);
    }

    public function hasModule(string $module): bool
    {
        return in_array($module, $this->active_modules ?? []);
    }

    public function isBusinessProfile(): bool
    {
        return in_array($this->type, ['sole_proprietor', 'business', 'ngo'], true);
    }

    public function hasVerifiedBusinessKyc(): bool
    {
        $this->loadMissing('kyc');

        return $this->isBusinessProfile()
            && (bool) $this->is_verified
            && $this->kyc_status === 'verified'
            && $this->kyc
            && $this->kyc->status === 'verified'
            && in_array($this->kyc->business_type, ['sole_proprietor', 'business', 'ngo'], true);
    }

    public function hasCompletedKyc(): bool
    {
        $this->loadMissing('kyc');

        $profileStatus = strtolower((string) $this->kyc_status);
        $kycStatus = strtolower((string) ($this->kyc?->status ?? ''));

        return (bool) $this->is_verified
            || in_array($profileStatus, ['approved', 'verified'], true)
            || in_array($kycStatus, ['approved', 'verified'], true);
    }

    public function canSellProducts(): bool
    {
        return $this->hasCompletedKyc();
    }

    public function isRetailEligible(): bool
    {
        return $this->hasVerifiedBusinessKyc();
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

    public function platformSubscriptions(): HasMany
    {
        return $this->hasMany(MerchantPlatformSubscription::class);
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

    public function strikes(): HasMany
    {
        return $this->hasMany(MerchantStrike::class);
    }

    public function trustSafetyReviews(): HasMany
    {
        return $this->hasMany(MerchantTrustSafetyReview::class);
    }

    public function serviceCredentials(): HasMany
    {
        return $this->hasMany(MerchantServiceCredential::class);
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

    public function defaultTimezone(): string
    {
        if (is_string($this->timezone) && in_array($this->timezone, timezone_identifiers_list(), true)) {
            return $this->timezone;
        }

        $this->loadMissing('country');

        return $this->country?->defaultTimezone() ?? 'Africa/Dar_es_Salaam';
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'merchant_id');
    }

    public function serviceRequests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class, 'merchant_id');
    }

    public function serviceIntegrations(): HasMany
    {
        return $this->hasMany(MerchantServiceIntegration::class, 'merchant_id');
    }

    public function serviceAvailabilityRules(): HasMany
    {
        return $this->hasMany(ServiceAvailabilityRule::class, 'merchant_id');
    }

    public function staff(): HasMany
    {
        return $this->hasMany(MerchantStaff::class);
    }

    public function stockTransfers(): HasMany
    {
        return $this->hasMany(StockTransfer::class);
    }

    public function retailAuditLogs(): HasMany
    {
        return $this->hasMany(RetailAuditLog::class);
    }
}
