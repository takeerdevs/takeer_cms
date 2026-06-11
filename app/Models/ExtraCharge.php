<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ExtraCharge extends Model
{
    protected $fillable = [
        'public_id',
        'order_id',
        'payment_order_id',
        'merchant_id',
        'buyer_id',
        'proposed_by_user_id',
        'accepted_by_user_id',
        'removed_by_user_id',
        'context',
        'charge_type',
        'title',
        'description',
        'amount',
        'currency_code',
        'status',
        'proposed_at',
        'accepted_at',
        'paid_at',
        'removed_at',
        'rejected_at',
        'cancelled_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'proposed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'paid_at' => 'datetime',
            'removed_at' => 'datetime',
            'rejected_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ExtraCharge $charge): void {
            if (! $charge->public_id) {
                $charge->public_id = (string) Str::uuid();
            }
        });
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function paymentOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'payment_order_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function proposedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'proposed_by_user_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by_user_id');
    }
}
