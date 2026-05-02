<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BundleCourseLesson extends Model
{
    protected $fillable = [
        'bundle_course_module_id',
        'title',
        'summary',
        'duration_minutes',
        'unlock_after_days',
        'is_preview',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'duration_minutes' => 'integer',
            'unlock_after_days' => 'integer',
            'is_preview' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(BundleCourseModule::class, 'bundle_course_module_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(BundleLessonAsset::class)->orderBy('sort_order');
    }

    public function liveSession(): HasOne
    {
        return $this->hasOne(BundleLiveSession::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(BundleCourseProgress::class);
    }
}
