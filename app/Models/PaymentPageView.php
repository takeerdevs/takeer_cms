<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentPageView extends Model
{
    protected $fillable = [
        'payment_page_id',
        'ip_address',
        'user_agent',
    ];

    public function paymentPage()
    {
        return $this->belongsTo(PaymentPage::class);
    }
}
