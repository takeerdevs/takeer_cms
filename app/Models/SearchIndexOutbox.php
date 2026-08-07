<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SearchIndexOutbox extends Model
{
    protected $table = 'search_index_outbox';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'available_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }
}
