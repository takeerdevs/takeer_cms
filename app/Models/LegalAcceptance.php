<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegalAcceptance extends Model
{
    protected $fillable = ['legal_document_id', 'user_id', 'merchant_id', 'accepted_at', 'ip_address', 'user_agent', 'locale', 'acceptance_action', 'evidence_payload'];
    protected function casts(): array { return ['accepted_at' => 'datetime', 'evidence_payload' => 'array']; }
    public function document(): BelongsTo { return $this->belongsTo(LegalDocument::class, 'legal_document_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function merchant(): BelongsTo { return $this->belongsTo(Merchant::class); }
}
