<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantSocialAccount extends Model
{
    protected $fillable = [
        'merchant_id',
        'connected_by',
        'platform',
        'provider_account_id',
        'username',
        'display_name',
        'account_type',
        'access_token',
        'token_expires_at',
        'status',
        'last_webhook_at',
        'metadata',
    ];

    protected $hidden = [
        'access_token',
    ];

    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            'last_webhook_at' => 'datetime',
            'metadata' => 'array',
            'access_token' => 'encrypted',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function connector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by');
    }

    public function dmCampaigns(): HasMany
    {
        return $this->hasMany(MerchantSocialDmCampaign::class, 'social_account_id');
    }

    public function dmEvents(): HasMany
    {
        return $this->hasMany(MerchantSocialDmEvent::class, 'social_account_id');
    }
}
