<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantServiceCredential;
use App\Models\ServiceCategory;
use App\Services\MediaUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MerchantServiceCredentialController extends Controller
{
    public function index(Merchant $merchant, MediaUploadService $mediaService): JsonResponse
    {
        $credentials = $merchant->serviceCredentials()
            ->with('serviceCategory:id,name,parent_id')
            ->latest()
            ->get()
            ->map(fn (MerchantServiceCredential $credential) => $this->serializeCredential($credential, $mediaService));

        return response()->json(['credentials' => $credentials]);
    }

    public function store(Request $request, Merchant $merchant, MediaUploadService $mediaService): JsonResponse
    {
        $validated = $request->validate([
            'service_category_id' => 'required|integer|exists:service_categories,id',
            'document_type' => ['required', 'string', Rule::in(['professional_license', 'certification', 'permit', 'business_license', 'other'])],
            'document_name' => 'required|string|max:160',
            'document_number' => 'nullable|string|max:120',
            'issuer' => 'nullable|string|max:160',
            'issued_at' => 'nullable|date|before_or_equal:today',
            'expires_at' => 'nullable|date|after:today',
            'document' => 'required|file|mimes:jpg,jpeg,png,webp,pdf|max:10240',
        ]);

        $category = ServiceCategory::query()->with('parent')->findOrFail((int) $validated['service_category_id']);
        $path = $mediaService->uploadFile($request->file('document'), 'service-credentials/' . $merchant->id, true);

        $credential = MerchantServiceCredential::create([
            'merchant_id' => $merchant->id,
            'service_category_id' => $category->id,
            'category_name' => $category->parent?->name ?: $category->name,
            'subcategory_name' => $category->parent ? $category->name : null,
            'document_type' => $validated['document_type'],
            'document_name' => $validated['document_name'],
            'document_number' => $validated['document_number'] ?? null,
            'issuer' => $validated['issuer'] ?? null,
            'issued_at' => $validated['issued_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'document_url' => "private://{$path}",
            'status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Cheti/leseni imepokelewa. Takeer itaikagua kabla ya kuruhusu huduma husika.',
            'credential' => $this->serializeCredential($credential->fresh('serviceCategory'), $mediaService),
        ], 201);
    }

    public function destroy(Merchant $merchant, MerchantServiceCredential $credential): JsonResponse
    {
        abort_if($credential->merchant_id !== $merchant->id, 404);
        abort_if($credential->status === 'verified', 422, 'Huwezi kufuta credential iliyothibitishwa.');

        $credential->delete();

        return response()->json(['message' => 'Credential imefutwa.']);
    }

    private function serializeCredential(MerchantServiceCredential $credential, MediaUploadService $mediaService): array
    {
        $path = Str::after((string) $credential->document_url, 'private://');
        $signedUrl = null;
        if ($path !== '') {
            try {
                $signedUrl = $mediaService->getSignedUrl($path);
            } catch (\Throwable) {
                $signedUrl = null;
            }
        }

        return [
            'id' => $credential->id,
            'service_category_id' => $credential->service_category_id,
            'category_name' => $credential->category_name,
            'subcategory_name' => $credential->subcategory_name,
            'document_type' => $credential->document_type,
            'document_name' => $credential->document_name,
            'document_number' => $credential->document_number,
            'issuer' => $credential->issuer,
            'issued_at' => $credential->issued_at?->toDateString(),
            'expires_at' => $credential->expires_at?->toDateString(),
            'status' => $credential->status,
            'rejection_reason' => $credential->rejection_reason,
            'reviewed_at' => $credential->reviewed_at?->toISOString(),
            'document_url' => $signedUrl,
            'created_at' => $credential->created_at?->toISOString(),
        ];
    }
}
