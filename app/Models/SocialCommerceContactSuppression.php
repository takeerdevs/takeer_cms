<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SocialCommerceContactSuppression extends Model
{
    public $timestamps = false;
    protected $fillable = ['contact_hash', 'reason', 'created_at', 'expires_at'];
    protected function casts(): array { return ['created_at' => 'datetime', 'expires_at' => 'datetime']; }
}
