<?php

namespace App\Services;

use App\Models\LegalAcceptance;
use App\Models\LegalDocument;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use RuntimeException;

class LegalAcceptanceService
{
    public const REQUIRED_CHECKOUT_DOCUMENTS = [
        'buyer_terms',
        'payment_provider_processing_terms',
        'refund_return_cancellation_dispute_policy',
        'privacy_notice',
    ];

    public const REQUIRED_MERCHANT_DOCUMENTS = [
        'merchant_marketplace_agreement',
        'payment_provider_processing_terms',
        'refund_return_cancellation_dispute_policy',
        'fee_payout_schedule',
        'privacy_notice',
        'restricted_products_services_policy',
        'complaints_redress_procedure',
    ];

    public function currentDocuments(array $types = self::REQUIRED_CHECKOUT_DOCUMENTS): Collection
    {
        return LegalDocument::query()
            ->where('status', 'active')
            ->whereIn('document_type', $types)
            ->where('effective_at', '<=', now())
            ->orderBy('document_type')
            ->get();
    }

    public function assertCheckoutReady(): Collection
    {
        $documents = $this->currentDocuments();
        $missing = collect(self::REQUIRED_CHECKOUT_DOCUMENTS)->diff($documents->pluck('document_type'));
        if ($missing->isNotEmpty()) {
            throw new RuntimeException('Required legal and PSP disclosures are not approved for checkout yet.');
        }

        return $documents;
    }

    public function recordFor(User $user, Request $request, ?int $merchantId, Collection $documents, string $action): void
    {
        foreach ($documents as $document) {
            LegalAcceptance::query()->firstOrCreate(
                [
                    'legal_document_id' => $document->id,
                    'user_id' => $user->id,
                    'merchant_id' => $merchantId,
                    'acceptance_action' => $action,
                ],
                [
                    'accepted_at' => now(),
                    'ip_address' => $request->ip(),
                    'user_agent' => substr((string) $request->userAgent(), 0, 65535),
                    'locale' => in_array($request->session()->get('user_session_language'), ['en', 'sw'], true)
                        ? $request->session()->get('user_session_language')
                        : ($request->getPreferredLanguage(['en', 'sw']) ?: 'en'),
                    'evidence_payload' => [
                        'document_version' => $document->version,
                        'content_hash_sha256' => $document->content_hash_sha256,
                        'action' => $action,
                    ],
                ],
            );
        }
    }

    public function assertMerchantReady(User $user, int $merchantId): Collection
    {
        $documents = $this->currentDocuments(self::REQUIRED_MERCHANT_DOCUMENTS);
        $missingDocuments = collect(self::REQUIRED_MERCHANT_DOCUMENTS)->diff($documents->pluck('document_type'));
        $acceptedDocumentIds = LegalAcceptance::query()
            ->where('user_id', $user->id)
            ->where('merchant_id', $merchantId)
            ->whereIn('legal_document_id', $documents->pluck('id'))
            ->pluck('legal_document_id');
        $missingAcceptances = $documents->whereNotIn('id', $acceptedDocumentIds);

        if ($missingDocuments->isNotEmpty() || $missingAcceptances->isNotEmpty()) {
            throw new RuntimeException('Merchant legal documents and provider processing terms must be approved and accepted before publishing.');
        }

        return $documents;
    }

    public function documentsForAcceptance(?int $merchantId): Collection
    {
        return $merchantId
            ? $this->currentDocuments(self::REQUIRED_MERCHANT_DOCUMENTS)
            : $this->currentDocuments(self::REQUIRED_CHECKOUT_DOCUMENTS);
    }
}
