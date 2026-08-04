<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AiModel extends Model
{
    protected $fillable = [
        'ai_provider_id',
        'model_key',
        'label',
        'capabilities',
        'input_cost_per_million',
        'output_cost_per_million',
        'is_active',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'capabilities' => 'array',
            'input_cost_per_million' => 'decimal:8',
            'output_cost_per_million' => 'decimal:8',
            'is_active' => 'boolean',
            'config' => 'array',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(AiProvider::class, 'ai_provider_id');
    }

    public function primaryTaskRoutes(): HasMany
    {
        return $this->hasMany(AiTaskRoute::class, 'primary_model_id');
    }

    public function supports(?string $capability): bool
    {
        if ($capability === null) {
            return true;
        }

        $capabilities = (array) ($this->capabilities ?: []);
        if (in_array('*', $capabilities, true) || in_array($capability, $capabilities, true)) {
            return true;
        }

        return match ($capability) {
            'tools', 'function_calling' => in_array('tools', $capabilities, true)
                || in_array('function_calling', $capabilities, true),
            'vision_json' => in_array('vision', $capabilities, true)
                && (in_array('structured_output', $capabilities, true) || in_array('json', $capabilities, true)),
            'image_edit' => in_array('image_edit', $capabilities, true)
                || in_array('image_generation', $capabilities, true),
            default => false,
        };
    }
}
