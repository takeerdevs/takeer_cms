<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProviderReconciliationBreak extends Model
{
    protected $fillable = [
        'reconciliation_run_id', 'break_type', 'order_id', 'payment_attempt_id', 'provider_payout_id',
        'provider_reference', 'amount_minor', 'currency', 'severity', 'status', 'owner', 'first_seen_at',
        'resolution', 'resolved_at', 'approved_by',
    ];

    protected function casts(): array
    {
        return ['first_seen_at' => 'datetime', 'resolved_at' => 'datetime'];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function payout(): BelongsTo { return $this->belongsTo(ProviderPayout::class, 'provider_payout_id'); }
    public function run(): BelongsTo { return $this->belongsTo(ProviderReconciliationRun::class, 'reconciliation_run_id'); }
}
