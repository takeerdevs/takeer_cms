<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MerchantSmsCampaign extends Model
{
    protected $fillable = [
        'merchant_id',
        'created_by',
        'name',
        'audience_type',
        'audience_ref_id',
        'message',
        'status',
        'estimated_recipients',
        'estimated_credits',
        'sent_count',
        'failed_count',
        'scheduled_at',
        'sent_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'audience_ref_id' => 'integer',
            'estimated_recipients' => 'integer',
            'estimated_credits' => 'integer',
            'sent_count' => 'integer',
            'failed_count' => 'integer',
            'scheduled_at' => 'datetime',
            'sent_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(MerchantSmsCampaignRecipient::class);
    }
}
