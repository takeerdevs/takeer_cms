<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantSmsBalance extends Model
{
    protected $fillable = [
        'merchant_id',
        'credits',
        'lifetime_purchased',
        'lifetime_used',
    ];

    protected function casts(): array
    {
        return [
            'credits' => 'integer',
            'lifetime_purchased' => 'integer',
            'lifetime_used' => 'integer',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
