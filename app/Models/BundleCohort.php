<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BundleCohort extends Model
{
    protected $fillable = [
        'bundle_id',
        'name',
        'starts_at',
        'enrollment_deadline',
        'capacity',
        'access_rule',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'enrollment_deadline' => 'datetime',
            'capacity' => 'integer',
        ];
    }

    public function bundle(): BelongsTo
    {
        return $this->belongsTo(Bundle::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(BundleCohortEnrollment::class);
    }
}
