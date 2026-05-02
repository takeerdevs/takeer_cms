<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BundleLessonAsset extends Model
{
    protected $fillable = [
        'bundle_course_lesson_id',
        'role',
        'asset_type',
        'asset_id',
        'selected_variant_id',
        'selected_variant_snapshot',
        'name',
        'url',
        'mime',
        'size',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'asset_id' => 'integer',
            'selected_variant_id' => 'integer',
            'selected_variant_snapshot' => 'array',
            'size' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(BundleCourseLesson::class, 'bundle_course_lesson_id');
    }
}
