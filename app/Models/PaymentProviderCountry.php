<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentProviderCountry extends Model
{
    protected $fillable = [
        'payment_provider_id',
        'country_code',
        'enabled',
        'supported_directions',
        'supported_currencies',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'supported_directions' => 'array',
            'supported_currencies' => 'array',
            'metadata' => 'array',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(PaymentProvider::class, 'payment_provider_id');
    }
}
