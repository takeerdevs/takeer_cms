<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantFollower extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'notification_preferences',
        'followed_at',
    ];

    protected function casts(): array
    {
        return [
            'notification_preferences' => 'array',
            'followed_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
