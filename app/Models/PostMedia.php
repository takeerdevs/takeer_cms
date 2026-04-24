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
        'media_type', // 'image', 'video', 'pdf'
        'product_image_id',
        'likes_count',
    ];

    protected $casts = [
        'likes_count' => 'integer',
        'product_image_id' => 'integer',
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
}
