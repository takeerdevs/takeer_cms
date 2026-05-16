<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailRecurringBill extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'vendor',
        'category',
        'amount',
        'currency_code',
        'frequency',
        'next_due_date',
        'remind_days_before',
        'sms_reminder_enabled',
        'payment_method',
        'reference_type',
        'status',
        'last_paid_at',
        'description',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'next_due_date' => 'date',
        'last_paid_at' => 'date',
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
