<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SearchIndexEntry extends Model
{
    protected $table = 'search_index';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'facets' => 'array',
            'display_data' => 'array',
            'price_min' => 'decimal:3',
            'price_max' => 'decimal:3',
            'price_min_base' => 'decimal:3',
            'price_max_base' => 'decimal:3',
            'in_stock' => 'boolean',
            'is_available' => 'boolean',
            'is_searchable' => 'boolean',
            'published_at' => 'datetime',
            'source_updated_at' => 'datetime',
            'indexed_at' => 'datetime',
            'embedding_updated_at' => 'datetime',
        ];
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(SearchIndexChunk::class, 'search_index_id');
    }
}
