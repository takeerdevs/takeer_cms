<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LinkPreview extends Model
{
    protected $fillable = [
        'url',
        'url_hash',
        'final_url',
        'title',
        'description',
        'site_name',
        'favicon_url',
        'remote_image_url',
        'image_url',
        'status',
        'embed_provider',
        'embed_type',
        'embed_url',
        'external_id',
        'fetched_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'fetched_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }
}
