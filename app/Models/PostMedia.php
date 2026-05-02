<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostMedia extends Model
{
    use HasFactory;

    protected $table = 'post_media';

    protected $fillable = [
        'post_id',
        'media_url',
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
        'product_image_id',
        'likes_count',
    ];

    protected $casts = [
        'likes_count' => 'integer',
        'product_image_id' => 'integer',
        'size' => 'integer',
        'duration_seconds' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
    ];

    /**
     * Get the post that owns the media.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * Get the linked product image (if any).
     */
    public function productImage(): BelongsTo
    {
        return $this->belongsTo(ProductImage::class, 'product_image_id');
    }

    /**
     * Get the effective URL (linked image or custom upload).
     */
    public function getUrlAttribute(): ?string
    {
        return $this->productImage?->image_url ?? $this->media_url;
    }

    public function getThumbnailUrlAttribute($value): ?string
    {
        return $this->productImage?->thumbnail_url ?? $value;
    }

    public function getProcessedUrlAttribute($value): ?string
    {
        return $this->productImage?->processed_url ?? $value;
    }

    public function getHlsUrlAttribute($value): ?string
    {
        return $this->productImage?->hls_url ?? $value;
    }
}
