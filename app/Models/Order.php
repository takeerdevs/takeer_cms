<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'public_id',
        'pickup_code',
        'buyer_id',
        'merchant_id',
        'product_id',
        'variant_id',
        'variant_snapshot',
        'bundle_item_selection',
        'purchasable_type',
        'purchasable_id',
        'order_kind',
        'quantity',
        'unit_price',
        'total_paid',
        'payment_status',
        'merchant_dispatch_video_url',
        'transaction_ref',
        'idempotency_key',
        'account_phone',
        'payment_phone',
        'is_inquiry',
        'inquiry_status',
        'shipping_fee',
        'discount_amount',
        // Payment gateway tracking (multi-country / multi-gateway)
        'payment_gateway', // e.g. 'azampay', 'mpesa_ke'
        'country_code',    // ISO 3166-1 alpha-2, e.g. 'TZ', 'KE'
        'gateway_ref',     // Gateway's own transaction ID for reconciliation
        'extra_items',     // Suggested items added during chat
        'expires_at',
        'payment_page_id',
        'source',
        'payment_mode',
        'pos_staff_id',
        'customer_name',
        'customer_phone',
        'grand_total',
        'approval_status',
        'approved_by_staff_id',
        'approval_requested_at',
        'counter_total',
        'manager_notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'variant_id' => 'integer',
            'variant_snapshot' => 'array',
            'bundle_item_selection' => 'array',
            'unit_price' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'total_paid' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'counter_total' => 'decimal:2',
            'is_inquiry' => 'boolean',
            'extra_items' => 'array',
            'expires_at' => 'datetime',
            'approval_requested_at' => 'datetime',
        ];
    }

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            if (! $order->public_id) {
                $order->public_id = static::generatePublicId();
            }
            if (! $order->pickup_code) {
                $order->pickup_code = static::generatePickupCode();
            }
        });
    }

    public static function generatePickupCode(int $length = 6): string
    {
        do {
            $code = strtoupper(\Illuminate\Support\Str::random($length));
            // Remove ambiguous chars
            $code = str_replace(['0', 'O', '1', 'I'], ['8', 'A', '2', 'B'], $code);
        } while (static::query()->where('pickup_code', $code)->exists());

        return $code;
    }

    public static function generatePublicId(int $length = 16): string
    {
        do {
            $candidate = \Illuminate\Support\Str::random($length);
        } while (static::query()->where('public_id', $candidate)->exists());

        return $candidate;
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'variant_id');
    }

    public function delivery(): HasOne
    {
        return $this->hasOne(Delivery::class);
    }

    public function dispute(): HasOne
    {
        return $this->hasOne(Dispute::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(ProductReview::class);
    }

    public function resolutions(): HasMany
    {
        return $this->hasMany(DisputeResolution::class);
    }

    public function posStaff(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'pos_staff_id');
    }

    public function posItems(): HasMany
    {
        return $this->hasMany(PosSaleItem::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(SubscriptionInvoice::class);
    }

    public function getResolvedPurchasableAttribute()
    {
        return match ($this->purchasable_type) {
            'product' => $this->product,
            'bundle' => Bundle::find($this->purchasable_id),
            'content_item' => ContentItem::find($this->purchasable_id),
            'subscription_plan' => SubscriptionPlan::find($this->purchasable_id),
            'post' => Post::find($this->purchasable_id),
            default => $this->product,
        };
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function isEscrowLocked(): bool
    {
        return $this->payment_status === 'escrow_locked';
    }

    public function isDisputed(): bool
    {
        return $this->payment_status === 'disputed';
    }

    public function isInquiry(): bool
    {
        return (bool) $this->is_inquiry;
    }

    public function isPendingQuote(): bool
    {
        return $this->is_inquiry && $this->inquiry_status === 'pending';
    }

    public function isCompleted(): bool
    {
        return in_array($this->payment_status, [
            'resolved_merchant_paid',
            'resolved_buyer_refunded',
        ]);
    }

    public function hasPhysicalBundleItems(): bool
    {
        if ($this->purchasable_type !== 'bundle' || empty($this->bundle_item_selection)) {
            return false;
        }

        foreach ($this->bundle_item_selection as $lineItem) {
            if (($lineItem['item_type'] ?? null) === 'product' && ($lineItem['product_type'] ?? null) === 'physical') {
                return true;
            }
        }

        return false;
    }

    public function requiresPhysicalFulfillment(): bool
    {
        return ($this->purchasable_type === 'product' && $this->product?->isPhysical())
            || $this->hasPhysicalBundleItems();
    }

    /**
     * Releases inventory back to the product/variant pool.
     */
    public function releaseInventory(): void
    {
        // 1. Individual Product/Variant
        if ($this->purchasable_type === 'product' && $this->product) {
            if ($this->product->isPhysical()) {
                if ($this->variant_id) {
                    ProductVariant::whereKey($this->variant_id)->increment('inventory_count', $this->quantity);
                }
                Product::whereKey($this->product_id)->increment('inventory_count', $this->quantity);
            }
        }

        // 2. Bundles
        if ($this->purchasable_type === 'bundle' && !empty($this->bundle_item_selection)) {
            foreach ($this->bundle_item_selection as $lineItem) {
                if (($lineItem['item_type'] ?? null) !== 'product') continue;
                if (($lineItem['product_type'] ?? null) !== 'physical') continue;
                
                $qty = (int) ($lineItem['quantity'] ?? 1);
                $productId = (int) ($lineItem['item_id'] ?? 0);
                $variantId = (int) ($lineItem['selected_variant_id'] ?? 0);

                if ($variantId > 0) {
                    ProductVariant::whereKey($variantId)->increment('inventory_count', $qty);
                }
                Product::whereKey($productId)->increment('inventory_count', $qty);
            }
        }
    }
}
