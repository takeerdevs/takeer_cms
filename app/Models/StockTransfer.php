<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransfer extends Model
{
    protected $fillable = [
        'merchant_id',
        'order_id',
        'product_id',
        'product_variant_id',
        'from_location_id',
        'to_location_id',
        'quantity',
        'requested_by_staff_id',
        'dispatched_by_staff_id',
        'received_by_staff_id',
        'status',
        'notes',
        'dispatched_at',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'dispatched_at' => 'datetime',
            'received_at' => 'datetime',
            'quantity' => 'integer',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function fromLocation(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'from_location_id');
    }

    public function toLocation(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'to_location_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'requested_by_staff_id');
    }

    public function dispatchedBy(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'dispatched_by_staff_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'received_by_staff_id');
    }
}
