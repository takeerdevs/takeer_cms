<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductLeadTimeTier extends Model
{
    protected $fillable = ['product_id', 'merchant_id', 'min_quantity', 'max_quantity', 'lead_time_days', 'label', 'sort_order'];

    protected function casts(): array
    {
        return [
            'min_quantity' => 'decimal:3',
            'max_quantity' => 'decimal:3',
            'lead_time_days' => 'integer',
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
