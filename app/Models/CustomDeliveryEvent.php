<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomDeliveryEvent extends Model
{
    protected $fillable = [
        'order_id',
        'actor_type',
        'actor_id',
        'event_type',
        'revision_number',
        'file_url',
        'file_name',
        'file_mime',
        'file_size',
        'message',
    ];

    protected function casts(): array
    {
        return [
            'actor_id' => 'integer',
            'revision_number' => 'integer',
            'file_size' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
