<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionInvoice extends Model
{
    protected $fillable = [
        'user_subscription_id',
        'order_id',
        'amount',
        'status',
        'billed_for_start',
        'billed_for_end',
        'paid_at',
        'reference',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'billed_for_start' => 'datetime',
            'billed_for_end' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(UserSubscription::class, 'user_subscription_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
