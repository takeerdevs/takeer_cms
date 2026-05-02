<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantServiceIntegration extends Model
{
    protected $fillable = [
        'merchant_id',
        'provider',
        'status',
        'external_account_id',
        'external_account_email',
        'calendar_id',
        'scopes',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'last_synced_at',
        'last_error',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'scopes' => 'array',
            'settings' => 'array',
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_expires_at' => 'datetime',
            'last_synced_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
