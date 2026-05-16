<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    public function fiscalRegimes(): HasMany
    {
        return $this->hasMany(FiscalRegime::class);
    }

    public function currency()
    {
        return $this->defaultCurrency();
    }

    public function timezones(): array
    {
        $timezones = $this->settings['timezones'] ?? [];

        if (is_array($timezones) && count($timezones) > 0) {
            return array_values(array_filter(
                $timezones,
                fn ($timezone) => is_string($timezone) && in_array($timezone, timezone_identifiers_list(), true)
            ));
        }

        return $this->isValidTimezone($this->timezone) ? [$this->timezone] : [];
    }

    public function defaultTimezone(): string
    {
        if ($this->isValidTimezone($this->timezone)) {
            return $this->timezone;
        }

        return $this->timezones()[0] ?? 'UTC';
    }

    private function isValidTimezone(?string $timezone): bool
    {
        return is_string($timezone) && in_array($timezone, timezone_identifiers_list(), true);
    }
}
