<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiProvider extends Model
{
    protected $fillable = [
        'key',
        'name',
        'base_url',
        'provider_type',
        'is_active',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'config' => 'array',
        ];
    }

    public function credentials(): HasMany
    {
        return $this->hasMany(AiCredential::class);
    }

    public function models(): HasMany
    {
        return $this->hasMany(AiModel::class);
    }
}
