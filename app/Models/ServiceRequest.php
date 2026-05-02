<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ServiceRequest extends Model
{
    protected $fillable = [
        'public_id',
        'payment_token',
        'merchant_id',
        'product_id',
        'buyer_id',
        'request_type',
        'status',
        'payment_status',
        'delivery_status',
        'delivered_at',
        'customer_confirmed_at',
        'disputed_at',
        'auto_confirm_after',
        'payment_link_expires_at',
        'payment_order_id',
        'customer_name',
        'customer_phone',
        'customer_email',
        'preferred_date',
        'preferred_time',
        'scheduled_at',
        'scheduled_ends_at',
        'timezone',
        'duration_minutes',
        'location_text',
        'message',
        'client_requirements',
        'quoted_amount',
        'deposit_amount',
        'booking_provider',
        'calendar_provider',
        'calendar_sync_status',
        'calendar_event_id',
        'calendar_sync_error',
        'calendar_synced_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'preferred_date' => 'date',
            'scheduled_at' => 'datetime',
            'scheduled_ends_at' => 'datetime',
            'payment_link_expires_at' => 'datetime',
            'delivered_at' => 'datetime',
            'customer_confirmed_at' => 'datetime',
            'disputed_at' => 'datetime',
            'auto_confirm_after' => 'datetime',
            'calendar_synced_at' => 'datetime',
            'duration_minutes' => 'integer',
            'client_requirements' => 'array',
            'quoted_amount' => 'decimal:2',
            'deposit_amount' => 'decimal:2',
            'metadata' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ServiceRequest $request): void {
            if (! $request->public_id) {
                $request->public_id = static::generatePublicId();
            }
        });
    }

    public static function generatePublicId(int $length = 16): string
    {
        do {
            $candidate = Str::random($length);
        } while (static::query()->where('public_id', $candidate)->exists());

        return $candidate;
    }

    public static function generatePaymentToken(int $length = 48): string
    {
        do {
            $candidate = Str::random($length);
        } while (static::query()->where('payment_token', $candidate)->exists());

        return $candidate;
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function paymentOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'payment_order_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(ServiceRequestNotification::class);
    }
}
