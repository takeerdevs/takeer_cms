<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialProductLink extends Model
{
    protected $fillable = [
        'merchant_id', 'merchant_social_account_id', 'product_id', 'platform', 'provider_post_id',
        'normalized_url', 'url_hash', 'status', 'verified_at', 'last_synced_at', 'metadata',
    ];

    protected function casts(): array
    {
        return ['verified_at' => 'datetime', 'last_synced_at' => 'datetime', 'metadata' => 'array'];
    }

    public function merchant(): BelongsTo { return $this->belongsTo(Merchant::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function merchantSocialAccount(): BelongsTo { return $this->belongsTo(MerchantSocialAccount::class); }
}
