<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentProvider extends Model
{
    protected $fillable = [
        'key',
        'name',
        'driver',
        'status',
        'logo_url',
        'config_schema',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'config_schema' => 'array',
            'metadata' => 'array',
        ];
    }

    public function countries(): HasMany
    {
        return $this->hasMany(PaymentProviderCountry::class);
    }

    public function channels(): HasMany
    {
        return $this->hasMany(PaymentProviderChannel::class);
    }

    public function isAvailable(): bool
    {
        return $this->status === 'enabled';
    }
}
