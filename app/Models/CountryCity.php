<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CountryCity extends Model
{
    protected $fillable = [
        'country_id',
        'state_id',
        'name',
        'normalized_name',
    ];

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class);
    }

    public function state(): BelongsTo
    {
        return $this->belongsTo(CountryState::class, 'state_id');
    }
}
