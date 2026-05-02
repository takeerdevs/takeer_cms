<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffAuthorizedDevice extends Model
{
    protected $fillable = [
        'merchant_staff_id',
        'device_id',
        'otp_code',
        'otp_expires_at',
        'is_verified',
        'last_used_at',
    ];

    protected $casts = [
        'otp_expires_at' => 'datetime',
        'last_used_at' => 'datetime',
        'is_verified' => 'boolean',
    ];

    public function staff(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'merchant_staff_id');
    }
}
