<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantCustomer extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'name',
        'phone',
        'total_spent',
        'order_count',
        'last_purchase_at',
    ];

    protected $casts = [
        'last_purchase_at' => 'datetime',
        'total_spent' => 'decimal:2',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
