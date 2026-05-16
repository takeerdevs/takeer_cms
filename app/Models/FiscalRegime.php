<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FiscalRegime extends Model
{
    protected $fillable = [
        'country_id',
        'code',
        'name',
        'authority_name',
        'required_fields',
        'settings',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'required_fields' => 'array',
            'settings' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function providers(): HasMany
    {
        return $this->hasMany(FiscalProvider::class);
    }
}
