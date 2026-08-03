<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportEnquiry extends Model
{
    public const CATEGORIES = [
        'order' => 'Order issue',
        'payment' => 'Payment or PSP settlement',
        'delivery' => 'Delivery',
        'digital_access' => 'Digital access',
        'merchant_account' => 'Merchant account',
        'safety' => 'Safety report',
        'other' => 'Other',
    ];

    public const STATUSES = ['new', 'open', 'resolved', 'closed'];

    protected $fillable = [
        'user_id',
        'resolved_by_id',
        'reference',
        'category',
        'status',
        'priority',
        'name',
        'email',
        'phone',
        'order_reference',
        'subject',
        'message',
        'internal_note',
        'metadata',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'resolved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_id');
    }
}
