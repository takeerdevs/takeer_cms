<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PulseNotification extends Model
{
    protected $fillable = [
        'user_id',
        'merchant_id',
        'subject_type',
        'subject_id',
        'event_type',
        'dedupe_key',
        'icon',
        'tone',
        'eyebrow',
        'title',
        'body',
        'meta',
        'href',
        'status',
        'payload',
        'read_at',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'read_at' => 'datetime',
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
