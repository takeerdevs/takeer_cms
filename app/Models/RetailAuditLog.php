<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailAuditLog extends Model
{
    protected $fillable = [
        'merchant_id',
        'staff_id',
        'user_id',
        'action',
        'description',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    /**
     * Prevent updates to existing audit logs (Immutable).
     */
    protected static function booted()
    {
        static::updating(function ($model) {
            return false;
        });

        static::deleting(function ($model) {
            return false;
        });
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'staff_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
