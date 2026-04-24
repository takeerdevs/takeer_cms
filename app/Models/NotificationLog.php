<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationLog extends Model
{
    protected $fillable = [
        'user_id',
        'phone',
        'message',
        'status',
        'error_message',
        'gateway',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
