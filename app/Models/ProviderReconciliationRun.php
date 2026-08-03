<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProviderReconciliationRun extends Model
{
    protected $fillable = [
        'payment_provider_id', 'business_date', 'source_type', 'source_reference', 'source_hash',
        'expected_count', 'actual_count', 'expected_amount_minor', 'actual_amount_minor', 'currency',
        'difference_amount_minor', 'status', 'started_at', 'completed_at', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return ['business_date' => 'date', 'started_at' => 'datetime', 'completed_at' => 'datetime', 'reviewed_at' => 'datetime'];
    }

    public function provider(): BelongsTo { return $this->belongsTo(PaymentProvider::class, 'payment_provider_id'); }
    public function breaks(): HasMany { return $this->hasMany(ProviderReconciliationBreak::class, 'reconciliation_run_id'); }
}
