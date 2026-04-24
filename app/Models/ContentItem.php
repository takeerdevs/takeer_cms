<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContentItem extends Model
{
    use SoftDeletes;

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    protected $fillable = [
        'merchant_id',
        'title',
        'slug',
        'excerpt',
        'body',
        'format',
        'visibility',
        'price',
        'currency_id',
        'moderation_status',
        'moderation_notes',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'published_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    public function bundleItems(): HasMany
    {
        return $this->hasMany(BundleItem::class, 'item_id')->where('item_type', 'content_item');
    }

    public function planItems(): HasMany
    {
        return $this->hasMany(SubscriptionPlanItem::class, 'item_id')->where('item_type', 'content_item');
    }
}
