<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class RetailBookkeepingEntry extends Model
{
    protected $fillable = [
        'merchant_id',
        'staff_id',
        'user_id',
        'entry_type',
        'category',
        'counterparty',
        'amount',
        'currency_code',
        'payment_method',
        'reference_type',
        'reference_number',
        'tax_type',
        'tax_period',
        'transaction_date',
        'description',
        'attachment_disk',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'attachment_size',
        'proof_status',
        'review_status',
        'reviewed_by_user_id',
        'reviewed_at',
        'review_note',
        'reconciliation_status',
        'statement_reference',
        'reconciled_by_user_id',
        'reconciled_at',
        'status',
        'voided_by_user_id',
        'voided_at',
        'void_reason',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'transaction_date' => 'date',
        'reviewed_at' => 'datetime',
        'reconciled_at' => 'datetime',
        'voided_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected $appends = ['attachment_url'];

    public function getAttachmentUrlAttribute(): ?string
    {
        if (!$this->attachment_disk || !$this->attachment_path) {
            return null;
        }

        return Storage::disk($this->attachment_disk)->url($this->attachment_path);
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

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function reconciledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reconciled_by_user_id');
    }

    public function fiscalReceipts(): HasMany
    {
        return $this->hasMany(FiscalReceipt::class, 'retail_bookkeeping_entry_id');
    }

    public function statementLines(): HasMany
    {
        return $this->hasMany(RetailBookkeepingStatementLine::class, 'matched_entry_id');
    }
}
