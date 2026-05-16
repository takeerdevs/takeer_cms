<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class RetailBookkeepingAccountItem extends Model
{
    protected $fillable = [
        'merchant_id',
        'staff_id',
        'user_id',
        'item_type',
        'status',
        'counterparty',
        'category',
        'amount',
        'paid_amount',
        'currency_code',
        'invoice_number',
        'issue_date',
        'due_date',
        'paid_at',
        'settlement_entry_id',
        'attachment_disk',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'attachment_size',
        'description',
        'void_reason',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'issue_date' => 'date',
        'due_date' => 'date',
        'paid_at' => 'date',
        'metadata' => 'array',
    ];

    protected $appends = ['attachment_url', 'balance_due'];

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_disk || !$this->attachment_path) {
            return null;
        }

        return Storage::disk($this->attachment_disk)->url($this->attachment_path);
    }

    public function getBalanceDueAttribute(): float
    {
        return max(0, (float) $this->amount - (float) $this->paid_amount);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'staff_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function settlementEntry(): BelongsTo
    {
        return $this->belongsTo(RetailBookkeepingEntry::class, 'settlement_entry_id');
    }
}
