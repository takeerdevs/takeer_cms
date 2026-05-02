<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BundleLiveSessionAttendance extends Model
{
    protected $fillable = [
        'bundle_live_session_id',
        'user_id',
        'marked_by_user_id',
        'status',
        'method',
        'checked_in_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'checked_in_at' => 'datetime',
        ];
    }

    public function liveSession(): BelongsTo
    {
        return $this->belongsTo(BundleLiveSession::class, 'bundle_live_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function markedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'marked_by_user_id');
    }
}
