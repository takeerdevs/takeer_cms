<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BundleCourseModule extends Model
{
    protected $fillable = [
        'bundle_id',
        'title',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function bundle(): BelongsTo
    {
        return $this->belongsTo(Bundle::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(BundleCourseLesson::class)->orderBy('sort_order');
    }
}
