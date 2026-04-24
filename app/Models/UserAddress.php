<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAddress extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'type',
        'address_line',
        'extra_details',
        'latitude',
        'longitude',
        'is_default',
        'forwarder_id',
        'forwarder_customer_id',
    ];

    protected $casts = [
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'is_default' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function forwarder(): BelongsTo
    {
        return $this->belongsTo(Forwarder::class);
    }
}
