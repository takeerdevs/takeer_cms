<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantWhatsappAccount extends Model
{
    protected $fillable = [
        'merchant_id',
        'connected_by',
        'phone_number_id',
        'business_account_id',
        'display_phone_number',
        'verified_name',
        'access_token',
        'status',
        'last_webhook_at',
        'metadata',
    ];

    protected $hidden = ['access_token'];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'last_webhook_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function automations(): HasMany
    {
        return $this->hasMany(MerchantWhatsappAutomation::class, 'whatsapp_account_id');
    }
}
