<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailBookkeepingPeriodLock extends Model
{
    protected $fillable = [
        'merchant_id',
        'period_key',
        'locked_by_user_id',
        'locked_at',
        'note',
    ];

    protected $casts = [
        'locked_at' => 'datetime',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function lockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by_user_id');
    }
}
