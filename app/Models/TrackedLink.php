<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrackedLink extends Model
{
    protected $fillable = [
        'merchant_id',
        'created_by',
        'code',
        'destination_hash',
        'destination_url',
        'destination_host',
        'label',
        'link_type',
        'source_surface',
        'entity_type',
        'entity_id',
        'clicks_count',
        'last_clicked_at',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'entity_id' => 'integer',
            'clicks_count' => 'integer',
            'last_clicked_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(ContentReport::class, 'item_id')->where('item_type', 'tracked_link');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
