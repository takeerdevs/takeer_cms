<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiscalReceipt extends Model
{
    protected $fillable = [
        'merchant_id',
        'country_id',
        'fiscal_regime_id',
        'fiscal_provider_id',
        'merchant_fiscal_integration_id',
        'order_id',
        'retail_bookkeeping_entry_id',
        'source_type',
        'status',
        'receipt_number',
        'verification_code',
        'verification_url',
        'qr_code_data',
        'z_report_reference',
        'request_payload',
        'provider_response',
        'attempts',
        'issued_at',
        'last_attempted_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'request_payload' => 'array',
            'provider_response' => 'array',
            'attempts' => 'integer',
            'issued_at' => 'datetime',
            'last_attempted_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(FiscalProvider::class, 'fiscal_provider_id');
    }

    public function integration(): BelongsTo
    {
        return $this->belongsTo(MerchantFiscalIntegration::class, 'merchant_fiscal_integration_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function bookkeepingEntry(): BelongsTo
    {
        return $this->belongsTo(RetailBookkeepingEntry::class, 'retail_bookkeeping_entry_id');
    }
}
