<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiCache extends Model
{
    protected $table = 'ai_cache';

    protected $fillable = [
        'query_hash',
        'response_json',
        'model_used',
        'hit_count',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'response_json' => 'array',
            'hit_count' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function incrementHitCount(): void
    {
        $this->increment('hit_count');
    }
}
