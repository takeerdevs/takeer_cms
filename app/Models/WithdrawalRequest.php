<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WithdrawalRequest extends Model
{
    protected $fillable = [
        'user_id',
        'merchant_id',
        'method',
        'payment_provider_id',
        'payment_provider_channel_id',
        'merchant_payout_credential_id',
        'amount',
        'merchant_currency_code',
        'payout_currency_code',
        'fx_base_currency_code',
        'fx_rate_merchant_to_base',
        'fx_rate_payout_to_base',
        'fx_rate_merchant_to_payout',
        'fx_market_rate_merchant_to_payout',
        'fx_effective_rate_merchant_to_payout',
        'fx_spread_bps',
        'fx_spread_amount',
        'fx_spread_currency_code',
        'fx_rate_date',
        'merchant_amount',
        'payout_amount',
        'payout_snapshot',
        'money_quote_snapshot',
        'status',
        'mpesa_transaction_id',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'fx_rate_merchant_to_base' => 'decimal:10',
            'fx_rate_payout_to_base' => 'decimal:10',
            'fx_rate_merchant_to_payout' => 'decimal:10',
            'fx_market_rate_merchant_to_payout' => 'decimal:10',
            'fx_effective_rate_merchant_to_payout' => 'decimal:10',
            'fx_spread_bps' => 'integer',
            'fx_spread_amount' => 'decimal:2',
            'fx_rate_date' => 'date',
            'merchant_amount' => 'decimal:2',
            'payout_amount' => 'decimal:2',
            'payout_snapshot' => 'array',
            'money_quote_snapshot' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function paymentProvider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }

    public function paymentProviderChannel(): BelongsTo
    {
        return $this->belongsTo(PaymentProviderChannel::class, 'payment_provider_channel_id');
    }

    public function payoutCredential(): BelongsTo
    {
        return $this->belongsTo(MerchantPayoutCredential::class, 'merchant_payout_credential_id');
    }
}
