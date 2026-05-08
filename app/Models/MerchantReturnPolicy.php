<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantReturnPolicy extends Model
{
    protected $fillable = [
        'merchant_id',
        'name',
        'policy',
        'window_days',
        'note',
        'is_default',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'window_days' => 'integer',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'return_policy_id');
    }
}
