<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialCommerceRequestEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'social_commerce_request_id', 'actor_type', 'actor_id', 'event_type', 'from_status', 'to_status',
        'channel', 'ip_hash', 'user_agent_summary', 'metadata', 'occurred_at', 'created_at',
    ];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'occurred_at' => 'datetime', 'created_at' => 'datetime'];
    }

    public function request(): BelongsTo { return $this->belongsTo(SocialCommerceRequest::class, 'social_commerce_request_id'); }
}
