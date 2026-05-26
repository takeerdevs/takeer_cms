<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForwarderRouteTransportMode extends Model
{
    protected $fillable = [
        'forwarder_route_id',
        'mode',
        'estimate',
        'pricing_model',
        'price_amount',
        'currency',
        'minimum_charge',
        'payment_term',
        'deposit_type',
        'deposit_value',
        'balance_due',
        'payment_notes',
        'notes',
        'allowed_items',
        'disallowed_items',
        'details',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(ForwarderRoute::class, 'forwarder_route_id');
    }
}
