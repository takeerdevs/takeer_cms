<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseLesson extends Model
{
    protected $fillable = [
        'module_id',
        'title',
        'type',
        'content_url',
        'body',
        'is_preview',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_preview' => 'boolean',
        ];
    }

    public function module()
    {
        return $this->belongsTo(CourseModule::class, 'course_module_id');
    }

    public function progress()
    {
        return $this->hasMany(CourseProgress::class, 'course_lesson_id');
    }

    public function isCompletedBy($userId)
    {
        return $this->progress()->where('user_id', $userId)->exists();
    }
}
