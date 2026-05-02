<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BundleLiveSession extends Model
{
    protected $fillable = [
        'bundle_course_lesson_id',
        'starts_at',
        'duration_minutes',
        'timezone',
        'meeting_url',
        'venue',
        'capacity',
        'notes',
        'check_in_code',
        'check_in_code_expires_at',
        'check_in_enabled',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'duration_minutes' => 'integer',
            'capacity' => 'integer',
            'check_in_code_expires_at' => 'datetime',
            'check_in_enabled' => 'boolean',
        ];
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(BundleCourseLesson::class, 'bundle_course_lesson_id');
    }

    public function attendances(): HasMany
    {
        return $this->hasMany(BundleLiveSessionAttendance::class);
    }
}
