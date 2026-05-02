<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceCategory extends Model
{
    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'is_active',
        'sort_order',
        'option_template',
        'risk_level',
        'required_documents',
        'requires_manual_review',
        'payout_hold_days',
        'max_first_quote_amount',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
            'option_template' => 'array',
            'required_documents' => 'array',
            'requires_manual_review' => 'boolean',
            'payout_hold_days' => 'integer',
            'max_first_quote_amount' => 'decimal:2',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(ServiceCategory::class, 'parent_id')
            ->orderBy('sort_order')
            ->orderBy('name');
    }
}
