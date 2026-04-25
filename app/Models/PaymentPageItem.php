<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PaymentPageItem extends Model
{
    protected $fillable = [
        'payment_page_id',
        'item_type',
        'item_id',
        'sort_order',
    ];

    public function paymentPage(): BelongsTo
    {
        return $this->belongsTo(PaymentPage::class);
    }

    public function item(): MorphTo
    {
        return $this->morphTo();
    }
}
