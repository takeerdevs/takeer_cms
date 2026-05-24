<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnRequest extends Model
{
    public const STATUS_PENDING = 'pending_merchant_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ITEM_RECEIVED = 'item_received';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_ESCALATED = 'escalated';

    protected $fillable = [
        'order_id',
        'buyer_id',
        'merchant_id',
        'product_id',
        'dispute_id',
        'status',
        'resolution_type',
        'reason',
        'evidence_url',
        'policy_snapshot',
        'merchant_note',
        'customer_note',
        'requested_at',
        'approved_at',
        'rejected_at',
        'received_at',
        'completed_at',
        'escalated_at',
    ];

    protected function casts(): array
    {
        return [
            'policy_snapshot' => 'array',
            'requested_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'received_at' => 'datetime',
            'completed_at' => 'datetime',
            'escalated_at' => 'datetime',
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

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function dispute(): BelongsTo
    {
        return $this->belongsTo(Dispute::class);
    }
}
