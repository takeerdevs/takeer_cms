<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class OfferingGroup extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'merchant_id',
        'created_by_user_id',
        'created_by_staff_id',
        'title',
        'slug',
        'group_type',
        'template_key',
        'status',
        'description',
        'cover_image_url',
        'pricing_mode',
        'base_price',
        'checkout_mode',
        'availability_mode',
        'display_settings',
        'checkout_rules',
        'availability_rules',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2',
            'display_settings' => 'array',
            'checkout_rules' => 'array',
            'availability_rules' => 'array',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function createdByStaff(): BelongsTo
    {
        return $this->belongsTo(MerchantStaff::class, 'created_by_staff_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OfferingGroupItem::class)->orderBy('section')->orderBy('sort_order')->orderBy('id');
    }
}
