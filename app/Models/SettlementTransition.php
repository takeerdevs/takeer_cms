<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SettlementTransition extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'order_settlement_id', 'from_state', 'to_state', 'reason_code', 'actor_type', 'actor_id', 'evidence', 'created_at',
    ];

    protected function casts(): array { return ['evidence' => 'array', 'created_at' => 'datetime']; }
    public function settlement(): BelongsTo { return $this->belongsTo(OrderSettlement::class, 'order_settlement_id'); }
}
