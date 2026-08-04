<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiCredential extends Model
{
    protected $fillable = [
        'ai_provider_id',
        'name',
        'secret',
        'key_hint',
        'status',
        'priority',
        'weight',
        'failure_count',
        'last_used_at',
        'last_failed_at',
        'disabled_until',
    ];

    protected $hidden = ['secret'];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'priority' => 'integer',
            'weight' => 'integer',
            'failure_count' => 'integer',
            'last_used_at' => 'datetime',
            'last_failed_at' => 'datetime',
            'disabled_until' => 'datetime',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(AiProvider::class, 'ai_provider_id');
    }

    public function isAvailable(): bool
    {
        return $this->status === 'active'
            && ($this->disabled_until === null || $this->disabled_until->isPast());
    }

    public function maskedKey(): ?string
    {
        return $this->key_hint ? '••••••••'.$this->key_hint : null;
    }
}
