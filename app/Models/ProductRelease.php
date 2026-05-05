<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductRelease extends Model
{
    protected $fillable = [
        'product_id',
        'version',
        'title',
        'changelog',
        'file_url',
        'mime',
        'size',
        'status',
        'is_latest',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'is_latest' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
