<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductLicenseActivation extends Model
{
    protected $fillable = [
        'product_license_key_id',
        'product_id',
        'merchant_id',
        'user_id',
        'device_hash',
        'device_id',
        'site_url',
        'app_version',
        'ip_address',
        'user_agent',
        'status',
        'activated_at',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'activated_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function licenseKey(): BelongsTo
    {
        return $this->belongsTo(ProductLicenseKey::class, 'product_license_key_id');
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
}
