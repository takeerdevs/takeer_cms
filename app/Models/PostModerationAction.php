<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PostModerationAction extends Model
{
    protected $fillable = [
        'post_id',
        'admin_id',
        'action',
        'reason_code',
        'public_reason',
        'internal_note',
        'show_public_notice',
    ];

    protected function casts(): array
    {
        return [
            'show_public_notice' => 'boolean',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
