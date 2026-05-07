<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantSocialDmEvent extends Model
{
    protected $fillable = [
        'merchant_id',
        'campaign_id',
        'social_account_id',
        'platform',
        'provider_comment_id',
        'provider_post_id',
        'commenter_provider_id',
        'commenter_username',
        'comment_text',
        'matched_keyword',
        'status',
        'dm_message',
        'destination_url',
        'provider_message_id',
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

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MerchantSocialDmCampaign::class, 'campaign_id');
    }

    public function socialAccount(): BelongsTo
    {
        return $this->belongsTo(MerchantSocialAccount::class, 'social_account_id');
    }
}
