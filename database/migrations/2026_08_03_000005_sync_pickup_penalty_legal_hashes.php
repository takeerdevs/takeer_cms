<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'buyer_terms' => 'docs/legal/buyer-terms.md',
            'merchant_marketplace_agreement' => 'MERCHANT_AGREEMENT.md',
            'payment_provider_processing_terms' => 'docs/legal/payment-provider-processing-terms.md',
            'refund_return_cancellation_dispute_policy' => 'docs/legal/refund-return-cancellation-dispute-policy.md',
        ] as $documentType => $relativePath) {
            $contents = (string) file_get_contents(base_path($relativePath));

            DB::table('legal_documents')
                ->where('document_type', $documentType)
                ->update([
                    'version' => '2026-08-03',
                    'content_hash_sha256' => hash('sha256', $contents),
                    'immutable_storage_uri' => $relativePath,
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        // Legal content hashes are append-only evidence and are not rolled back.
    }
};
