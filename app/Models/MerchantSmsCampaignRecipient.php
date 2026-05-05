<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantSmsCampaignRecipient extends Model
{
    protected $fillable = [
        'merchant_sms_campaign_id',
        'user_id',
        'name',
        'phone',
        'tracking_code',
        'landing_url',
        'status',
        'notification_log_id',
        'error_message',
        'sent_at',
        'clicked_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'clicked_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MerchantSmsCampaign::class, 'merchant_sms_campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function notificationLog(): BelongsTo
    {
        return $this->belongsTo(NotificationLog::class);
    }
}
