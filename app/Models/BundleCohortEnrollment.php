<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BundleCohortEnrollment extends Model
{
    protected $fillable = [
        'bundle_cohort_id',
        'user_id',
        'order_id',
        'status',
        'enrolled_at',
    ];

    protected function casts(): array
    {
        return [
            'enrolled_at' => 'datetime',
        ];
    }

    public function cohort(): BelongsTo
    {
        return $this->belongsTo(BundleCohort::class, 'bundle_cohort_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
