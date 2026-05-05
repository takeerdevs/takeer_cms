<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductLicenseKey extends Model
{
    protected $fillable = [
        'product_id',
        'merchant_id',
        'user_id',
        'order_id',
        'license_key',
        'key_hash',
        'status',
        'activation_count',
        'last_activated_at',
        'last_activation_ip',
        'activation_meta',
        'issued_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'license_key' => 'encrypted',
            'activation_count' => 'integer',
            'last_activated_at' => 'datetime',
            'activation_meta' => 'array',
            'issued_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function activations(): HasMany
    {
        return $this->hasMany(ProductLicenseActivation::class);
    }
}
