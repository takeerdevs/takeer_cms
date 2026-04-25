<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentPage extends Model
{
    protected $fillable = [
        'merchant_id',
        'slug',
        'title',
        'description',
        'cover_image',
        'amount',
        'currency',
        'theme_color',
        'settings',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'settings' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PaymentPageItem::class)->orderBy('sort_order');
    }

    public function views(): HasMany
    {
        return $this->hasMany(PaymentPageView::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
