<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'phone_number',
        'phone_verified_at',
        'role',
        'password',
        'is_admin',
        'is_banned',
        'is_shadow_user',
        'shadow_source',
        'onboarded_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    // Append derived fields so they appear in JSON (Inertia shared auth.user)
    protected $appends = ['is_merchant', 'merchant_summary', 'recent_orders'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_banned' => 'boolean',
            'is_shadow_user' => 'boolean',
            'onboarded_at' => 'datetime',
        ];
    }

    /**
     * Derived boolean: merchant if role === 'merchant' OR a future is_merchant column.
     * Using PHP attribute so frontend/AdminController can use $user->is_merchant.
     */
    public function getIsMerchantAttribute(): bool
    {
        return $this->role === 'merchant';
    }

    /**
     * Get summary stats for the merchant dashboard.
     */
    public function getMerchantSummaryAttribute(): array
    {
        if (!$this->is_merchant) return [];

        $wallet = $this->wallet;
        $productIds = $this->products()->pluck('products.id');
        
        return [
            'wallet_balance' => (float) ($wallet->balance ?? 0),
            'frozen_balance' => (float) ($wallet->frozen_balance ?? 0),
            'total_products' => $this->products()->count(),
            'orders_today'   => Order::whereIn('product_id', $productIds)
                                    ->whereDate('created_at', now()->today())
                                    ->count(),
            'orders_pending' => Order::whereIn('product_id', $productIds)
                                    ->whereIn('payment_status', ['awaiting_payment', 'escrow_locked'])
                                    ->count(),
            'orders_completed' => Order::whereIn('product_id', $productIds)
                                    ->whereIn('payment_status', ['resolved_merchant_paid'])
                                    ->count(),
        ];
    }

    /**
     * Get recent orders for the merchant dashboard.
     */
    public function getRecentOrdersAttribute()
    {
        if (!$this->is_merchant) return [];

        $merchantIds = $this->merchantProfiles()->pluck('id');

        return Order::whereIn('merchant_id', $merchantIds)
            ->with(['product:id,title,type,url,download_link', 'product.images'])
            ->latest()
            ->take(5)
            ->get()
            ->map(function($order) {
                $display = $this->resolveOrderDisplay($order);

                return [
                    'id' => $order->id,
                    'public_id' => $order->public_id,
                    'source' => $order->source,
                    'amount' => (float) $order->total_paid,
                    'status' => $order->payment_status,
                    'created_at' => $order->created_at?->toISOString(),
                    'display_title' => $display['title'],
                    'display_kind' => $display['kind'],
                    'display_icon' => $display['icon'],
                    'display_image' => $display['image'],
                ];
            });
    }

    public function resolveOrderDisplay(Order $order): array
    {
        // Try direct product relationship first (common for POS orders)
        if ($order->product || ($order->purchasable_type === 'product' && $order->product)) {
            $product = $order->product;
            $productType = $product->type;
            $kind = match ($productType) {
                'physical' => 'physical_product',
                'service' => 'service_booking',
                default => 'digital_file',
            };

            return [
                'title' => $product->title ?: 'Untitled product',
                'kind' => $kind,
                'icon' => match ($kind) {
                    'physical_product' => 'shopping_bag',
                    'service_booking' => 'calendar_clock',
                    default => 'download',
                },
                'image' => $product->image_url,
            ];
        }

        if ($order->purchasable_type === 'post') {
            $post = Post::find($order->purchasable_id);
            return [
                'title' => $post?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'book_open',
                'image' => $post?->cover_image_url,
            ];
        }

        if ($order->purchasable_type === 'content_item') {
            $content = ContentItem::find($order->purchasable_id);
            return [
                'title' => $content?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'book_open',
                'image' => $content?->cover_image_url,
            ];
        }

        if ($order->purchasable_type === 'bundle') {
            $bundle = Bundle::find($order->purchasable_id);
            return [
                'title' => $bundle?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'boxes',
                'image' => $bundle?->cover_image_url,
            ];
        }

        if ($order->purchasable_type === 'subscription_plan') {
            $plan = SubscriptionPlan::find($order->purchasable_id);
            return [
                'title' => $plan?->name ?: 'Membership plan',
                'kind' => 'subscription_plan',
                'icon' => 'crown',
                'image' => null,
            ];
        }

        return [
            'title' => $order->product?->title ?: 'Order item',
            'kind' => 'post_content',
            'icon' => 'book_open',
            'image' => $order->product?->image_url,
        ];
    }

    // ─── Relationships ──────────────────────────────────────────────────────────

    /**
     * Get the merchant profiles (accounts) managed by the user.
     */
    public function merchantProfiles(): HasMany
    {
        return $this->hasMany(Merchant::class);
    }

    public function products(): HasManyThrough
    {
        return $this->hasManyThrough(Product::class, Merchant::class, 'user_id', 'merchant_id');
    }

    public function posts(): HasManyThrough
    {
        return $this->hasManyThrough(Post::class, Merchant::class, 'user_id', 'merchant_id');
    }

    public function shippingZones(): HasMany
    {
        return $this->hasMany(ShippingZone::class, 'merchant_id');
    }

    public function oneClickProfile(): HasOne
    {
        return $this->hasOne(OneClickProfile::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'buyer_id');
    }

    public function wallet(): HasOne
    {
        return $this->hasOne(Wallet::class)->whereNull('merchant_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function withdrawalRequests(): HasMany
    {
        return $this->hasMany(WithdrawalRequest::class);
    }

    public function notificationLogs(): HasMany
    {
        return $this->hasMany(NotificationLog::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(UserSubscription::class);
    }

    public function entitlements(): HasMany
    {
        return $this->hasMany(Entitlement::class);
    }

    public function cohortEnrollments(): HasMany
    {
        return $this->hasMany(BundleCohortEnrollment::class);
    }

    public function liveSessionAttendances(): HasMany
    {
        return $this->hasMany(BundleLiveSessionAttendance::class);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isMerchant(): bool
    {
        return $this->role === 'merchant';
    }

    public function isBuyer(): bool
    {
        return $this->role === 'buyer';
    }

    public function isAdmin(): bool
    {
        return (bool) $this->is_admin;
    }

    public function isBanned(): bool
    {
        return (bool) $this->is_banned;
    }

    public function addresses(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(UserAddress::class);
    }

    public function staffProfile(int $merchantId)
    {
        return \App\Models\MerchantStaff::where('user_id', $this->id)
            ->where('merchant_id', $merchantId)
            ->first();
    }
}
