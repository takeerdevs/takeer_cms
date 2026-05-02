<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ExchangeRateHistory extends Model
{
    use HasFactory;

    protected $table = 'exchange_rate_histories';

    protected $fillable = [
        'base_currency_code',
        'currency_code',
        'rate',
        'effective_date',
        'is_manual',
        'source',
    ];

    protected $casts = [
        'rate' => 'decimal:10',
        'effective_date' => 'date',
        'is_manual' => 'boolean',
    ];

    /**
     * Get the currency associated with the history.
     */
    public function currency()
    {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }
}
