<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BundleCourseProgress extends Model
{
    protected $table = 'bundle_course_progress';

    protected $fillable = [
        'bundle_course_lesson_id',
        'user_id',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
        ];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(BundleCourseLesson::class, 'bundle_course_lesson_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
