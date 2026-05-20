<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferingGroupItem extends Model
{
    public const TYPE_PRODUCT = 'product';
    public const TYPE_OFFERING_GROUP = 'offering_group';

    protected $fillable = [
        'offering_group_id',
        'item_type',
        'item_id',
        'section',
        'sort_order',
        'role',
        'pricing_behavior',
        'price_override',
        'quantity_min',
        'quantity_max',
        'is_required',
        'is_default_selected',
        'is_orderable_alone',
        'is_orderable_in_group',
        'choice_rules',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'price_override' => 'decimal:2',
            'quantity_min' => 'decimal:3',
            'quantity_max' => 'decimal:3',
            'is_required' => 'boolean',
            'is_default_selected' => 'boolean',
            'is_orderable_alone' => 'boolean',
            'is_orderable_in_group' => 'boolean',
            'choice_rules' => 'array',
            'metadata' => 'array',
        ];
    }

    public function offeringGroup(): BelongsTo
    {
        return $this->belongsTo(OfferingGroup::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'item_id');
    }

    public function childGroup(): BelongsTo
    {
        return $this->belongsTo(OfferingGroup::class, 'item_id');
    }

    public function itemModel(): Product|OfferingGroup|null
    {
        return match ($this->item_type) {
            self::TYPE_PRODUCT => $this->product,
            self::TYPE_OFFERING_GROUP => $this->childGroup,
            default => null,
        };
    }
}
