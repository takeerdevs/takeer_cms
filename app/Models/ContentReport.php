<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContentReport extends Model
{
    protected $fillable = [
        'reporter_id',
        'merchant_id',
        'item_type',
        'item_id',
        'reason',
        'notes',
        'status',
        'reviewed_by_id',
        'action_taken',
        'resolution_note',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'item_id' => 'integer',
            'resolved_at' => 'datetime',
        ];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }
}
