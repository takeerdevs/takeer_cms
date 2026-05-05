<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantGroupSaleParticipant extends Model
{
    protected $fillable = [
        'campaign_id',
        'user_id',
        'name',
        'phone',
        'email',
        'quantity',
        'status',
        'wants_sms_updates',
        'converted_order_id',
        'joined_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'wants_sms_updates' => 'boolean',
            'joined_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MerchantGroupSaleCampaign::class, 'campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'converted_order_id');
    }
}
