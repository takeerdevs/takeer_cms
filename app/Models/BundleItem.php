<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BundleItem extends Model
{
    protected $fillable = [
        'bundle_id',
        'item_type',
        'item_id',
        'selected_variant_id',
        'selected_variant_snapshot',
        'section_title',
        'lesson_title',
        'lesson_summary',
        'lesson_duration_minutes',
        'unlock_after_days',
        'is_preview',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'item_id' => 'integer',
            'selected_variant_id' => 'integer',
            'selected_variant_snapshot' => 'array',
            'lesson_duration_minutes' => 'integer',
            'unlock_after_days' => 'integer',
            'is_preview' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function bundle(): BelongsTo
    {
        return $this->belongsTo(Bundle::class);
    }
}
