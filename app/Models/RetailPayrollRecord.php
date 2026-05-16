<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailPayrollRecord extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'worker_name',
        'worker_type',
        'role',
        'gross_amount',
        'deductions_amount',
        'net_amount',
        'currency_code',
        'pay_period',
        'pay_date',
        'payment_method',
        'reference_number',
        'tax_type',
        'status',
        'bookkeeping_entry_id',
        'attachment_disk',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'attachment_size',
        'description',
        'metadata',
    ];

    protected $casts = [
        'gross_amount' => 'decimal:2',
        'deductions_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'pay_date' => 'date',
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

    public function bookkeepingEntry(): BelongsTo
    {
        return $this->belongsTo(RetailBookkeepingEntry::class, 'bookkeeping_entry_id');
    }
}
