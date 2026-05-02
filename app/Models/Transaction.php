<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'user_id',
        'order_id',
        'type',
        'fee_policy_id',
        'fee_policy_name',
        'fee_policy_type',
        'fee_percentage_rate',
        'fee_fixed_amount',
        'fee_fixed_currency_code',
        'fee_fixed_amount_converted',
        'fee_payment_channel',
        'currency_code',
        'base_currency_code',
        'fx_rate_to_base',
        'fx_rate_date',
        'gross_amount',
        'gross_amount_base',
        'fee_amount',
        'fee_amount_base',
        'net_amount',
        'net_amount_base',
        'tax_amount',
        'tax_amount_base',
        'reference',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'decimal:2',
            'gross_amount_base' => 'decimal:2',
            'fee_amount' => 'decimal:2',
            'fee_amount_base' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'net_amount_base' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'tax_amount_base' => 'decimal:2',
            'fx_rate_to_base' => 'decimal:10',
            'fx_rate_date' => 'date',
            'fee_percentage_rate' => 'decimal:4',
            'fee_fixed_amount' => 'decimal:2',
            'fee_fixed_amount_converted' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Transaction $transaction): void {
            $currencyCode = $transaction->currency_code ?: static::resolveCurrencyCode($transaction);
            $baseCurrencyCode = $transaction->base_currency_code ?: static::resolveBaseCurrencyCode();
            $rate = static::resolveFxRate($currencyCode);

            $transaction->currency_code = $currencyCode;
            $transaction->base_currency_code = $baseCurrencyCode;
            $transaction->fx_rate_to_base = $transaction->fx_rate_to_base ?: $rate;
            $transaction->fx_rate_date = $transaction->fx_rate_date ?: now()->toDateString();

            if ($rate > 0) {
                if ($transaction->gross_amount_base === null) {
                    $transaction->gross_amount_base = static::convertToBase($transaction->gross_amount, $rate);
                }
                if ($transaction->fee_amount_base === null) {
                    $transaction->fee_amount_base = static::convertToBase($transaction->fee_amount, $rate);
                }
                if ($transaction->net_amount_base === null) {
                    $transaction->net_amount_base = static::convertToBase($transaction->net_amount, $rate);
                }
                if ($transaction->tax_amount_base === null) {
                    $transaction->tax_amount_base = static::convertToBase($transaction->tax_amount, $rate);
                }
            }
        });
    }

    private static function resolveCurrencyCode(Transaction $transaction): string
    {
        if ($transaction->order_id) {
            $order = Order::query()
                ->with('merchant.currency')
                ->find($transaction->order_id);

            if ($order?->merchant?->currency?->code) {
                return $order->merchant->currency->code;
            }
        }

        $merchant = Merchant::query()
            ->with('currency')
            ->where('user_id', $transaction->user_id)
            ->orderByDesc('is_default')
            ->first();

        return $merchant?->currency?->code ?: 'TZS';
    }

    private static function resolveBaseCurrencyCode(): string
    {
        return Currency::query()
            ->where('is_base_currency', true)
            ->value('code') ?: 'USD';
    }

    private static function resolveFxRate(string $currencyCode): float
    {
        $rate = ExchangeRateHistory::query()
            ->where('base_currency_code', static::resolveBaseCurrencyCode())
            ->where('currency_code', $currencyCode)
            ->whereDate('effective_date', '<=', now()->toDateString())
            ->latest('effective_date')
            ->value('rate');

        if (! $rate) {
            $rate = Currency::query()
                ->where('code', $currencyCode)
                ->value('exchange_rate');
        }

        return max((float) ($rate ?: 1), 0.0000000001);
    }

    private static function convertToBase(null|string|float|int $amount, float $rate): float
    {
        return round(((float) ($amount ?? 0)) / $rate, 2);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function feePolicy(): BelongsTo
    {
        return $this->belongsTo(FeePolicy::class);
    }
}
