<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailBookkeepingShareAccessLog extends Model
{
    protected $fillable = [
        'retail_bookkeeping_share_link_id',
        'merchant_id',
        'event',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function shareLink(): BelongsTo
    {
        return $this->belongsTo(RetailBookkeepingShareLink::class, 'retail_bookkeeping_share_link_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }
}
