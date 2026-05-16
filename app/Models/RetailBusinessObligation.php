<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailBusinessObligation extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'title',
        'obligation_type',
        'authority',
        'due_date',
        'remind_days_before',
        'sms_reminder_enabled',
        'status',
        'completed_at',
        'reference_number',
        'description',
        'metadata',
    ];

    protected $casts = [
        'due_date' => 'date',
        'completed_at' => 'datetime',
        'sms_reminder_enabled' => 'boolean',
        'metadata' => 'array',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
