<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Country extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'iso_alpha2',
        'phone_code',
        'continent',
        'flag',
        'timezone',
        'default_language',
        'is_active',
        'default_currency_id',
        'default_tax_rate',
        'tax_label',
        'apply_tax_by_default',
        'state_name',
        'city_name',
        'settings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'apply_tax_by_default' => 'boolean',
        'default_tax_rate' => 'decimal:2',
        'settings' => 'array',
    ];

    public function defaultCurrency()
    {
        return $this->belongsTo(Currency::class, 'default_currency_id');
    }

    public function currency()
    {
        return $this->defaultCurrency();
    }
}
