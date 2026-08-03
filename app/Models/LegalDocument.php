<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LegalDocument extends Model
{
    protected $fillable = ['document_type', 'version', 'effective_at', 'content_hash_sha256', 'immutable_storage_uri', 'approval_reference', 'status'];
    protected function casts(): array { return ['effective_at' => 'datetime']; }
    public function acceptances(): HasMany { return $this->hasMany(LegalAcceptance::class); }
}
