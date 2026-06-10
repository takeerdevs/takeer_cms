<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RefundRequest extends Model
{
    protected $fillable = [
        'order_id',
        'buyer_id',
        'merchant_id',
        'approved_by',
        'source',
        'status',
        'amount',
        'currency_code',
        'merchant_penalty_amount',
        'merchant_penalty_percent',
        'reason',
        'snapshot',
        'approved_at',
        'rejected_at',
        'admin_notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'merchant_penalty_amount' => 'decimal:2',
            'merchant_penalty_percent' => 'decimal:2',
            'snapshot' => 'array',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
