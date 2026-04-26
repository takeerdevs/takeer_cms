<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MerchantKyc extends Model
{
    protected $fillable = [
        'merchant_id',
        'business_type', // individual, sole_proprietor, business, ngo
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
        'tin_number',
        'tin_document_url',
        'brela_number',
        'business_license_url',
        'registration_doc_url',
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
