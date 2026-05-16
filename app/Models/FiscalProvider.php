<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FiscalProvider extends Model
{
    protected $fillable = [
        'fiscal_regime_id',
        'code',
        'name',
        'status',
        'credential_schema',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'credential_schema' => 'array',
            'settings' => 'array',
        ];
    }

    public function regime(): BelongsTo
    {
        return $this->belongsTo(FiscalRegime::class, 'fiscal_regime_id');
    }
}
