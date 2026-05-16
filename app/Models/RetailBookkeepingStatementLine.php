<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailBookkeepingStatementLine extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'matched_entry_id',
        'source_type',
        'source_name',
        'transaction_date',
        'reference_number',
        'counterparty',
        'description',
        'line_type',
        'amount',
        'currency_code',
        'status',
        'matched_at',
        'attachment_disk',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'attachment_size',
        'raw_payload',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'amount' => 'decimal:2',
        'matched_at' => 'datetime',
        'raw_payload' => 'array',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function matchedEntry(): BelongsTo
    {
        return $this->belongsTo(RetailBookkeepingEntry::class, 'matched_entry_id');
    }
}
