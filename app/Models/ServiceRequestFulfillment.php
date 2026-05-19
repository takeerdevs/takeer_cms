<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ServiceRequestFulfillment extends Model
{
    protected $fillable = [
        'service_request_id',
        'merchant_id',
        'product_id',
        'recorded_by',
        'module_key',
        'action',
        'status',
        'notes',
        'room_number',
        'unit_label',
        'pickup_point',
        'guide_name',
        'practitioner',
        'appointment_room',
        'table_label',
        'session_title',
        'reference_code',
        'certificate_status',
        'deposit_status',
        'guests',
        'party_size',
        'attendee_count',
        'check_in_at',
        'check_out_at',
        'departure_at',
        'pickup_at',
        'return_due_at',
        'due_at',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'guests' => 'integer',
            'party_size' => 'integer',
            'attendee_count' => 'integer',
            'check_in_at' => 'datetime',
            'check_out_at' => 'datetime',
            'departure_at' => 'datetime',
            'pickup_at' => 'datetime',
            'return_due_at' => 'datetime',
            'due_at' => 'datetime',
            'recorded_at' => 'datetime',
        ];
    }

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(ServiceRequestFulfillmentEvent::class);
    }
}
