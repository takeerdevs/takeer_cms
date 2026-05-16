<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantFiscalIntegration extends Model
{
    protected $fillable = [
        'merchant_id',
        'country_id',
        'fiscal_regime_id',
        'fiscal_provider_id',
        'status',
        'mode',
        'tin',
        'vrn',
        'branch_code',
        'device_serial',
        'credentials',
        'settings',
        'last_verified_at',
        'last_error',
        'provider_access_expires_at',
    ];

    protected $hidden = ['credentials'];

    protected function casts(): array
    {
        return [
            'credentials' => 'encrypted:array',
            'settings' => 'array',
            'last_verified_at' => 'datetime',
            'provider_access_expires_at' => 'datetime',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function regime(): BelongsTo
    {
        return $this->belongsTo(FiscalRegime::class, 'fiscal_regime_id');
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(FiscalProvider::class, 'fiscal_provider_id');
    }

    public function hasUsableCredentials(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        $credentials = is_array($this->credentials) ? $this->credentials : [];
        $hasApiKey = trim((string) ($credentials['api_key'] ?? '')) !== '';
        $hasUserPass = trim((string) ($credentials['username'] ?? '')) !== ''
            && trim((string) ($credentials['password'] ?? '')) !== '';

        return trim((string) $this->tin) !== ''
            && ($hasApiKey || $hasUserPass)
            && !$this->providerAccessExpired();
    }

    public function providerAccessExpired(): bool
    {
        $expiresAt = $this->provider_access_expires_at
            ?? data_get($this->settings, 'provider_access_expires_at');

        if (!$expiresAt) {
            return false;
        }

        return now()->greaterThanOrEqualTo($expiresAt);
    }
}
