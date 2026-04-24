<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MerchantStorefrontSetting extends Model
{
    protected $fillable = [
        'merchant_profile_id',
        'section_order',
        'links',
        'custom_sections',
        'hidden_sections',
        'featured_product_id',
        'allow_post_comments',
        'allow_post_reactions',
        'service_hours',
        'service_timezone',
        'service_area_type',
        'service_locations',
    ];

    protected function casts(): array
    {
        return [
            'section_order' => 'array',
            'links' => 'array',
            'custom_sections' => 'array',
            'hidden_sections' => 'array',
            'featured_product_id' => 'integer',
            'allow_post_comments' => 'boolean',
            'allow_post_reactions' => 'boolean',
            'service_hours' => 'array',
            'service_locations' => 'array',
        ];
    }

    public function merchantProfile(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_profile_id');
    }
}
