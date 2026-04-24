<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Entitlement extends Model
{
    protected $fillable = [
        'user_id',
        'merchant_id',
        'item_type',
        'item_id',
        'source_type',
        'source_id',
        'status',
        'starts_at',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'item_id' => 'integer',
            'source_id' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
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
}
