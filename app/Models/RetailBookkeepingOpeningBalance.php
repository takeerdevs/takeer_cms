<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetailBookkeepingOpeningBalance extends Model
{
    protected $fillable = [
        'merchant_id',
        'user_id',
        'as_of_date',
        'cash_balance',
        'bank_balance',
        'mobile_money_balance',
        'stock_value',
        'director_loan_balance',
        'accounts_receivable',
        'accounts_payable',
        'currency_code',
        'note',
    ];

    protected $casts = [
        'as_of_date' => 'date',
        'cash_balance' => 'decimal:2',
        'bank_balance' => 'decimal:2',
        'mobile_money_balance' => 'decimal:2',
        'stock_value' => 'decimal:2',
        'director_loan_balance' => 'decimal:2',
        'accounts_receivable' => 'decimal:2',
        'accounts_payable' => 'decimal:2',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
