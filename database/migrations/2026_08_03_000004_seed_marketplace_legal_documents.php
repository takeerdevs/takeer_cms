<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $documents = [
            'buyer_terms' => 'docs/legal/buyer-terms.md',
            'merchant_marketplace_agreement' => 'MERCHANT_AGREEMENT.md',
            'payment_provider_processing_terms' => 'docs/legal/payment-provider-processing-terms.md',
            'refund_return_cancellation_dispute_policy' => 'docs/legal/refund-return-cancellation-dispute-policy.md',
            'fee_payout_schedule' => 'docs/legal/fee-payout-schedule.md',
            'privacy_notice' => 'docs/legal/privacy-notice.md',
            'restricted_products_services_policy' => 'docs/legal/restricted-products-services-policy.md',
            'complaints_redress_procedure' => 'docs/legal/complaints-redress-procedure.md',
        ];

        foreach ($documents as $type => $relativePath) {
            $absolutePath = base_path($relativePath);
            $contents = is_file($absolutePath) ? file_get_contents($absolutePath) : $type;
            DB::table('legal_documents')->updateOrInsert(
                ['document_type' => $type, 'version' => '2026-08-03-draft'],
                [
                    'effective_at' => now(),
                    'content_hash_sha256' => hash('sha256', (string) $contents),
                    'immutable_storage_uri' => $relativePath,
                    'approval_reference' => null,
                    'status' => 'pending_approval',
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }
    }

    public function down(): void
    {
        DB::table('legal_documents')->where('version', '2026-08-03-draft')->delete();
    }
};
