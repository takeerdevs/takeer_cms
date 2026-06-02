<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantProductCertificate;
use App\Services\MediaUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MerchantProductCertificateController extends Controller
{
    public function index(Merchant $merchant, MediaUploadService $mediaService): JsonResponse
    {
        $certificates = $merchant->productCertificates()
            ->latest()
            ->get()
            ->map(fn (MerchantProductCertificate $certificate) => $this->serializeCertificate($certificate, $mediaService, true));

        return response()->json(['certificates' => $certificates]);
    }

    public function store(Request $request, Merchant $merchant, MediaUploadService $mediaService): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:160',
            'certificate_type' => 'nullable|string|max:80',
            'description' => 'nullable|string|max:2000',
            'document_number' => 'nullable|string|max:120',
            'issuer' => 'nullable|string|max:160',
            'authority' => 'nullable|string|max:160',
            'issued_at' => 'nullable|date|before_or_equal:today',
            'expires_at' => 'nullable|date|after_or_equal:issued_at',
            'visibility' => ['required', 'string', Rule::in(['private', 'public_summary', 'public_file'])],
            'document' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:10240',
        ]);

        $path = $mediaService->uploadFile($request->file('document'), 'product-certificates/' . $merchant->id, true);

        $certificate = MerchantProductCertificate::create([
            'merchant_id' => $merchant->id,
            'title' => $validated['title'],
            'certificate_type' => $validated['certificate_type'] ?? null,
            'description' => $validated['description'] ?? null,
            'document_number' => $validated['document_number'] ?? null,
            'issuer' => $validated['issuer'] ?? null,
            'authority' => $validated['authority'] ?? null,
            'issued_at' => $validated['issued_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'visibility' => $validated['visibility'],
            'document_url' => "private://{$path}",
            'status' => 'merchant_provided',
        ]);

        return response()->json([
            'message' => 'Certificate imeongezwa. Unaweza kuiattach kwenye bidhaa utakazochagua.',
            'certificate' => $this->serializeCertificate($certificate, $mediaService, true),
        ], 201);
    }

    public function destroy(Merchant $merchant, MerchantProductCertificate $certificate): JsonResponse
    {
        abort_if((int) $certificate->merchant_id !== (int) $merchant->id, 404);

        $certificate->products()->detach();
        $certificate->delete();

        return response()->json(['message' => 'Certificate imefutwa.']);
    }

    public function serializeCertificate(MerchantProductCertificate $certificate, MediaUploadService $mediaService, bool $includePrivateFile = false): array
    {
        $path = Str::after((string) $certificate->document_url, 'private://');
        $signedUrl = null;

        if ($path !== '' && ($includePrivateFile || $certificate->visibility === 'public_file')) {
            try {
                $signedUrl = $mediaService->getSignedUrl($path);
            } catch (\Throwable) {
                $signedUrl = null;
            }
        }

        return [
            'id' => $certificate->id,
            'title' => $certificate->title,
            'certificate_type' => $certificate->certificate_type,
            'description' => $certificate->description,
            'document_number' => $certificate->document_number,
            'issuer' => $certificate->issuer,
            'authority' => $certificate->authority,
            'issued_at' => $certificate->issued_at?->toDateString(),
            'expires_at' => $certificate->expires_at?->toDateString(),
            'visibility' => $certificate->visibility,
            'status' => $certificate->status,
            'display_status' => $this->displayStatus($certificate),
            'rejection_reason' => $includePrivateFile ? $certificate->rejection_reason : null,
            'reviewed_at' => $certificate->reviewed_at?->toISOString(),
            'document_url' => $signedUrl,
            'created_at' => $certificate->created_at?->toISOString(),
        ];
    }

    private function displayStatus(MerchantProductCertificate $certificate): string
    {
        return match ($certificate->status) {
            'verified' => 'Takeer verified',
            'pending_review' => 'Pending Takeer review',
            'rejected' => 'Rejected',
            'expired' => 'Expired',
            default => 'Merchant provided',
        };
    }
}
