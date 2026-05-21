<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeliveryEvent extends Model
{
    protected $fillable = [
        'delivery_id',
        'order_id',
        'status',
        'actor_type',
        'actor_user_id',
        'proof_url',
        'proof_mime',
        'proof_type',
        'note',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'delivery_id' => 'integer',
            'order_id' => 'integer',
            'actor_user_id' => 'integer',
            'metadata' => 'array',
        ];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
