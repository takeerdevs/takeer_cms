<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HealthCheckSnapshot extends Model
{
    protected $fillable = [
        'status',
        'duration_ms',
        'checks',
        'checked_at',
    ];

    protected function casts(): array
    {
        return [
            'checks' => 'array',
            'checked_at' => 'datetime',
        ];
    }

    public function isHealthy(): bool
    {
        return $this->status === 'ok';
    }
}
