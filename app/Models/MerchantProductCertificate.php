<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class MerchantProductCertificate extends Model
{
    protected $fillable = [
        'merchant_id',
        'title',
        'certificate_type',
        'description',
        'document_number',
        'issuer',
        'authority',
        'issued_at',
        'expires_at',
        'document_url',
        'visibility',
        'status',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
    ];

    protected $casts = [
        'issued_at' => 'date',
        'expires_at' => 'date',
        'reviewed_at' => 'datetime',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'merchant_product_certificate_product')
            ->withPivot('public_note')
            ->withTimestamps();
    }

    public function isPubliclyVisible(): bool
    {
        if ($this->visibility === 'private') {
            return false;
        }

        if (in_array($this->status, ['rejected', 'expired'], true)) {
            return false;
        }

        return ! $this->expires_at || $this->expires_at->endOfDay()->isFuture();
    }
}
