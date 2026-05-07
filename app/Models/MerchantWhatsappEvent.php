<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantWhatsappEvent extends Model
{
    protected $fillable = [
        'merchant_id',
        'automation_id',
        'whatsapp_account_id',
        'provider_message_id',
        'from_phone',
        'profile_name',
        'message_text',
        'matched_keyword',
        'status',
        'response_message',
        'destination_url',
        'provider_response_id',
        'error_message',
        'received_at',
        'sent_at',
        'clicked_at',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'sent_at' => 'datetime',
            'clicked_at' => 'datetime',
            'payload' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function automation(): BelongsTo
    {
        return $this->belongsTo(MerchantWhatsappAutomation::class, 'automation_id');
    }

    public function whatsappAccount(): BelongsTo
    {
        return $this->belongsTo(MerchantWhatsappAccount::class, 'whatsapp_account_id');
    }
}
