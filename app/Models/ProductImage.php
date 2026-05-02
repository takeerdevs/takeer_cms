<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductImage extends Model
{
    protected $fillable = [
        'product_id',
        'image_url',
        'media_type',
        'thumbnail_url',
        'processed_url',
        'hls_url',
        'mime',
        'size',
        'duration_seconds',
        'width',
        'height',
        'processing_status',
        'processing_error',
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
            'size' => 'integer',
            'duration_seconds' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
