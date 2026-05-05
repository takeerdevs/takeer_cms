<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

use App\Traits\InteractsWithImpressions;

class Post extends Model
{
    use SoftDeletes, InteractsWithImpressions;

    protected $fillable = [
        'public_id',
        'merchant_id',
        'content_item_id',
        'link_preview_id',
        'source',
        'caption',
        'title',
        'excerpt',
        'body',
        'bg_style',
        'is_restricted',
        'restricted_price',
        'comments_enabled_override',
        'reactions_enabled_override',
        'views_count',
        'click_count',
        'likes_count',
        'share_count',
        'comment_count',
    ];

    protected function casts(): array
    {
        return [
            'is_restricted' => 'boolean',
            'comments_enabled_override' => 'boolean',
            'reactions_enabled_override' => 'boolean',
            'restricted_price' => 'decimal:2',
            'views_count' => 'integer',
            'click_count' => 'integer',
            'likes_count' => 'integer',
            'share_count' => 'integer',
            'comment_count' => 'integer',
        ];
    }

    public function promotableBundles()
    {
        return $this->morphedByMany(Bundle::class, 'promotable', 'post_promotables');
    }

    public function promotableSubscriptions()
    {
        return $this->morphedByMany(SubscriptionPlan::class, 'promotable', 'post_promotables');
    }

    public function promotableProducts()
    {
        return $this->morphedByMany(Product::class, 'promotable', 'post_promotables');
    }

    public function getPromotablesAttribute()
    {
        return collect()
            ->concat($this->relationLoaded('promotableProducts') ? $this->promotableProducts : [])
            ->concat($this->relationLoaded('promotableBundles') ? $this->promotableBundles : [])
            ->concat($this->relationLoaded('promotableSubscriptions') ? $this->promotableSubscriptions : []);
    }

    protected static function booted(): void
    {
        static::creating(function (Post $post): void {
            if (! $post->public_id) {
                $post->public_id = static::generatePublicId();
            }
        });
    }

    public static function generatePublicId(int $length = 11): string
    {
        do {
            $candidate = Str::random($length);
        } while (static::query()->where('public_id', $candidate)->exists());

        return $candidate;
    }

    /**
     * Get the owner of the post (The Merchant Profile).
     */
    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(PostMedia::class);
    }

    public function moderationActions(): HasMany
    {
        return $this->hasMany(PostModerationAction::class);
    }

    public function latestModerationAction(): HasOne
    {
        return $this->hasOne(PostModerationAction::class)->latestOfMany();
    }

    public function productTags(): HasMany
    {
        return $this->hasMany(PostProductTag::class);
    }

    /**
     * Directly linked product (for posts created from products).
     */
    public function linkedProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function linkedContentItem(): BelongsTo
    {
        return $this->belongsTo(ContentItem::class, 'content_item_id')->withTrashed();
    }

    public function linkPreview(): BelongsTo
    {
        return $this->belongsTo(LinkPreview::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function likes(): HasMany
    {
        return $this->hasMany(PostLike::class);
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PostReaction::class);
    }

    /**
     * Get the primary product associated with this post.
     */
    public function product()
    {
        return $this->hasOneThrough(Product::class, PostProductTag::class, 'post_id', 'id', 'id', 'product_id');
    }

    /**
     * Check if the post is liked by a specific user.
     */
    public function isLikedBy(?User $user): bool
    {
        if (!$user)
            return false;
        return $this->likes()->where('user_id', $user->id)->exists();
    }
}
