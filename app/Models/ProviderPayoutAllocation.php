<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderPayoutAllocation extends Model
{
    protected $fillable = ['provider_payout_id', 'order_settlement_id', 'amount_minor'];
    public function payout(): BelongsTo { return $this->belongsTo(ProviderPayout::class, 'provider_payout_id'); }
    public function settlement(): BelongsTo { return $this->belongsTo(OrderSettlement::class, 'order_settlement_id'); }
}
