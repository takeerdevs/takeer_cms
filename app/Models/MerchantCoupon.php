<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantCoupon extends Model
{
    protected $fillable = [
        'merchant_id',
        'code',
        'name',
        'description',
        'discount_type',
        'discount_value',
        'minimum_order_amount',
        'maximum_discount_amount',
        'applies_to_type',
        'applies_to_id',
        'usage_limit',
        'usage_limit_per_customer',
        'times_used',
        'starts_at',
        'ends_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'decimal:2',
            'minimum_order_amount' => 'decimal:2',
            'maximum_discount_amount' => 'decimal:2',
            'usage_limit' => 'integer',
            'usage_limit_per_customer' => 'integer',
            'times_used' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'merchant_coupon_id');
    }

    public function isActiveNow(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }

        if ($this->usage_limit !== null && $this->times_used >= $this->usage_limit) {
            return false;
        }

        return true;
    }

    public function appliesTo(string $type, int $id): bool
    {
        return $this->applies_to_type === 'all'
            || ($this->applies_to_type === $type && (int) $this->applies_to_id === $id);
    }

    public function calculateDiscount(float $subtotal): float
    {
        if ($this->minimum_order_amount !== null && $subtotal < (float) $this->minimum_order_amount) {
            return 0.0;
        }

        $discount = $this->discount_type === 'fixed'
            ? (float) $this->discount_value
            : $subtotal * ((float) $this->discount_value / 100);

        if ($this->maximum_discount_amount !== null) {
            $discount = min($discount, (float) $this->maximum_discount_amount);
        }

        return round(max(0, min($subtotal, $discount)), 2);
    }
}
