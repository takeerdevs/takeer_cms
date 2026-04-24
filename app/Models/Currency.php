<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Currency extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'symbol',
        'symbol_position', // 'prefix' or 'suffix'
        'exchange_rate',
        'is_base_currency',
        'is_active',
    ];

    protected $casts = [
        'exchange_rate' => 'decimal:4',
        'is_base_currency' => 'boolean',
        'is_active' => 'boolean',
    ];
}
