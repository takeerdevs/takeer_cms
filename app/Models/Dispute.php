<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Dispute extends Model
{
    protected $fillable = [
        'order_id',
        'buyer_unboxing_video_url',
        'dispute_reason',
        'refund_eligibility_status',
        'refund_eligibility_reason',
        'refund_policy_snapshot',
        'admin_resolution_notes',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'refund_policy_snapshot' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function resolution(): HasOne
    {
        return $this->hasOne(DisputeResolution::class, 'order_id', 'order_id');
    }
}
