<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantWhatsappAutomation extends Model
{
    protected $fillable = [
        'merchant_id',
        'whatsapp_account_id',
        'created_by',
        'name',
        'trigger_keywords',
        'match_mode',
        'destination_type',
        'destination_id',
        'destination_url',
        'response_message',
        'status',
        'received_count',
        'matched_count',
        'sent_count',
        'failed_count',
        'clicks_count',
        'starts_at',
        'ends_at',
        'last_triggered_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'trigger_keywords' => 'array',
            'destination_id' => 'integer',
            'received_count' => 'integer',
            'matched_count' => 'integer',
            'sent_count' => 'integer',
            'failed_count' => 'integer',
            'clicks_count' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'last_triggered_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function whatsappAccount(): BelongsTo
    {
        return $this->belongsTo(MerchantWhatsappAccount::class, 'whatsapp_account_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(MerchantWhatsappEvent::class, 'automation_id');
    }

    public function isActiveNow(): bool
    {
        if ($this->status !== 'active') return false;
        if ($this->starts_at && $this->starts_at->isFuture()) return false;
        if ($this->ends_at && $this->ends_at->isPast()) return false;

        return true;
    }
}
