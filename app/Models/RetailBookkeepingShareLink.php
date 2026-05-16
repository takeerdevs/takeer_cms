<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RetailBookkeepingShareLink extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'token',
        'password_hash',
        'recipient_name',
        'recipient_role',
        'from_date',
        'to_date',
        'sections',
        'include_proofs',
        'allow_downloads',
        'expires_at',
        'last_accessed_at',
        'revoked_at',
        'access_count',
        'status',
    ];

    protected $casts = [
        'from_date' => 'date',
        'to_date' => 'date',
        'sections' => 'array',
        'include_proofs' => 'boolean',
        'allow_downloads' => 'boolean',
        'expires_at' => 'datetime',
        'last_accessed_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    protected $hidden = ['password_hash'];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function accessLogs(): HasMany
    {
        return $this->hasMany(RetailBookkeepingShareAccessLog::class);
    }
}
