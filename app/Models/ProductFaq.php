<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductFaq extends Model
{
    protected $fillable = [
        'product_id',
        'merchant_id',
        'asked_by_user_id',
        'answered_by_user_id',
        'question',
        'answer',
        'source',
        'is_published',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'asked_by_user_id' => 'integer',
            'answered_by_user_id' => 'integer',
            'is_published' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
