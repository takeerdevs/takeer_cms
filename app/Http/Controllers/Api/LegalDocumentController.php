<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LegalAcceptance;
use App\Models\LegalDocument;
use App\Models\Merchant;
use App\Services\LegalAcceptanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LegalDocumentController extends Controller
{
    public function index(Request $request, LegalAcceptanceService $legal): JsonResponse
    {
        $merchantId = $request->integer('merchant_id') ?: null;
        if ($merchantId) {
            $merchant = Merchant::query()->findOrFail($merchantId);
            abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);
        }

        $documents = $merchantId
            ? $legal->merchantDocumentsForDisplay()
            : $legal->documentsForAcceptance(null);
        $acceptedDocumentIds = $merchantId
            ? LegalAcceptance::query()
                ->where('user_id', $request->user()->id)
                ->where('merchant_id', $merchantId)
                ->whereIn('legal_document_id', $documents->pluck('id'))
                ->pluck('legal_document_id')
            : collect();

        return response()->json([
            'documents' => $documents->map(fn (LegalDocument $document) => [
                'document_type' => $document->document_type,
                'version' => $document->version,
                'effective_at' => $document->effective_at,
                'content_hash_sha256' => $document->content_hash_sha256,
                'immutable_storage_uri' => $document->immutable_storage_uri,
                'accepted' => $acceptedDocumentIds->contains($document->id),
                'required' => ! $merchantId || in_array($document->document_type, LegalAcceptanceService::REQUIRED_MERCHANT_DOCUMENTS, true),
            ])->values(),
            'merchant_id' => $merchantId,
        ]);
    }

    public function accept(Request $request, LegalAcceptanceService $legal): JsonResponse
    {
        abort_unless($request->user(), 401);
        $validated = $request->validate([
            'merchant_id' => ['nullable', 'integer', 'exists:merchants,id'],
            'accept' => ['required', 'accepted'],
        ]);
        $merchantId = isset($validated['merchant_id']) ? (int) $validated['merchant_id'] : null;
        if ($merchantId) {
            $merchant = Merchant::query()->findOrFail($merchantId);
            abort_unless((int) $merchant->user_id === (int) $request->user()->id, 403);
        }
        $documents = $merchantId
            ? $legal->acceptMerchant($request->user(), $request, $merchantId)
            : $legal->documentsForAcceptance(null);
        if (! $merchantId) {
            $required = LegalAcceptanceService::REQUIRED_CHECKOUT_DOCUMENTS;
            abort_if(collect($required)->diff($documents->pluck('document_type'))->isNotEmpty(), 503, 'Required legal and PSP documents are not active.');
            $legal->recordFor($request->user(), $request, null, $documents, 'user_clickwrap');
        }

        return response()->json(['accepted' => true, 'documents' => $documents->pluck('document_type')->values()]);
    }

    public function adminIndex(): JsonResponse
    {
        return response()->json(['documents' => LegalDocument::query()->latest('effective_at')->get()]);
    }

    public function activate(Request $request, LegalDocument $legalDocument): JsonResponse
    {
        $validated = $request->validate([
            'approval_reference' => ['required', 'string', 'max:255'],
            'immutable_storage_uri' => ['required', 'string', 'max:255'],
        ]);
        $legalDocument->update([
            'status' => 'active',
            'approval_reference' => $validated['approval_reference'],
            'immutable_storage_uri' => $validated['immutable_storage_uri'],
        ]);

        return response()->json(['document' => $legalDocument->fresh()]);
    }
}
