<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantSocialDmCampaign extends Model
{
    protected $fillable = [
        'merchant_id',
        'social_account_id',
        'created_by',
        'name',
        'platform',
        'post_provider_id',
        'post_url',
        'trigger_keywords',
        'match_mode',
        'destination_type',
        'destination_id',
        'destination_url',
        'dm_message',
        'public_reply_message',
        'status',
        'comments_count',
        'matched_count',
        'dm_sent_count',
        'dm_failed_count',
        'clicks_count',
        'starts_at',
        'ends_at',
        'last_triggered_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'social_account_id' => 'integer',
            'destination_id' => 'integer',
            'trigger_keywords' => 'array',
            'comments_count' => 'integer',
            'matched_count' => 'integer',
            'dm_sent_count' => 'integer',
            'dm_failed_count' => 'integer',
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

    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(MerchantSocialAccount::class, 'social_account_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(MerchantSocialDmEvent::class, 'campaign_id');
    }

    public function isActiveNow(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->starts_at && $this->starts_at->isFuture()) {
            return false;
        }

        if ($this->ends_at && $this->ends_at->isPast()) {
            return false;
        }

        return true;
    }
}
