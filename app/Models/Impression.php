<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Impression extends Model
{
    protected $fillable = [
        'merchant_id',
        'impressionable_id',
        'impressionable_type',
        'ip_address',
        'user_agent',
    ];

    public function impressionable(): MorphTo
    {
        return $this->morphTo();
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
