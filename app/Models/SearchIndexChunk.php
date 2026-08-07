<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SearchIndexChunk extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'facets' => 'array',
            'price_min' => 'decimal:3',
            'price_max' => 'decimal:3',
            'in_stock' => 'boolean',
            'embedding_updated_at' => 'datetime',
        ];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(SearchIndexEntry::class, 'search_index_id');
    }
}
