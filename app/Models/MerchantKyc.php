<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MerchantKyc extends Model
{
    protected $fillable = [
        'merchant_id',
        'first_name',
        'last_name',
        'id_type',
        'id_number',
        'id_front_url',
        'id_back_url',
        'date_of_birth',
        'gender',
        'residential_address',
        'occupation',
        'status',
        'rejection_reason',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }
}
