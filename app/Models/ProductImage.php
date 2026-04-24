<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductImage extends Model
{
    protected $fillable = [
        'product_id',
        'image_url',
        'order',
        'hotspots',
        'likes_count',
    ];

    protected function casts(): array
    {
        return [
            'hotspots' => 'array',
            'order' => 'integer',
            'likes_count' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
