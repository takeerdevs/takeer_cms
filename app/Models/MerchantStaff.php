<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Hash;

class MerchantStaff extends Model
{
    protected $table = 'merchant_staffs';

    protected $fillable = [
        'merchant_id',
        'user_id',
        'assigned_location_id',
        'role',
        'pin_hash',
        'is_active',
    ];

    protected $hidden = [
        'pin_hash',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
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

    public function location(): BelongsTo
    {
        return $this->belongsTo(MerchantLocation::class, 'assigned_location_id');
    }

    public function setPin(string $pin): void
    {
        $this->update(['pin_hash' => Hash::make($pin)]);
    }

    public function verifyPin(string $pin): bool
    {
        return Hash::check($pin, $this->pin_hash);
    }

    public function authorizedDevices(): HasMany
    {
        return $this->hasMany(StaffAuthorizedDevice::class, 'merchant_staff_id');
    }
}
