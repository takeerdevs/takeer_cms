<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentItemVersion extends Model
{
    protected $fillable = [
        'content_item_id',
        'version',
        'created_by_user_id',
        'title',
        'excerpt',
        'body',
        'format',
        'body_hash',
    ];

    public function contentItem(): BelongsTo
    {
        return $this->belongsTo(ContentItem::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }
}
