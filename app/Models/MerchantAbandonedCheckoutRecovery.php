<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantAbandonedCheckoutRecovery extends Model
{
    protected $fillable = [
        'automation_id',
        'marketing_event_id',
        'user_id',
        'notification_log_id',
        'phone',
        'status',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
    }

    public function automation(): BelongsTo
    {
        return $this->belongsTo(MerchantAbandonedCheckoutAutomation::class, 'automation_id');
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(MarketingEvent::class, 'marketing_event_id');
    }
}
