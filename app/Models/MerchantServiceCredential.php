<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantServiceCredential extends Model
{
    protected $fillable = [
        'merchant_id',
        'service_category_id',
        'category_name',
        'subcategory_name',
        'document_type',
        'document_name',
        'document_number',
        'issuer',
        'issued_at',
        'expires_at',
        'document_url',
        'status',
        'rejection_reason',
        'review_checklist',
        'review_notes',
        'reviewed_by',
        'reviewed_at',
        'last_expiry_reminder_at',
        'expired_at',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'date',
            'expires_at' => 'date',
            'review_checklist' => 'array',
            'reviewed_at' => 'datetime',
            'last_expiry_reminder_at' => 'datetime',
            'expired_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function serviceCategory(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
