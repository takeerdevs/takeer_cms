<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LinkPreview;
use App\Services\SocialCommerceContactExtractionService;
use App\Services\SocialCommercePreviewService;
use App\Services\SocialCommerceSellerSignalExtractionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class SocialCommercePreviewController extends Controller
{
    public function store(Request $request, SocialCommercePreviewService $previews): JsonResponse
    {
        if (!config('social_commerce.enabled')) {
            return response()->json(['message' => 'Social-commerce previews are temporarily unavailable.', 'status' => 'disabled'], 503);
        }
        $data = $request->validate([
            'url' => ['required', 'string', 'url:http,https', 'max:2048'],
            'phone_region' => ['nullable', 'string', 'regex:/^[A-Za-z]{2}$/'],
        ]);
        try {
            $sessionRegion = $request->hasSession()
                ? strtoupper((string) data_get($request->session()->get('user_session_country'), 'iso_alpha2', ''))
                : '';
            $phoneRegion = strtoupper((string) ($data['phone_region'] ?? '')) ?: $sessionRegion;

            return response()->json($previews->preview($data['url'], [
                'ip' => $request->ip(),
                'phone_region' => $phoneRegion ?: null,
            ]), 200);
        } catch (InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage(), 'status' => 'unsupported'], 422);
        }
    }

    public function show(
        LinkPreview $preview,
        SocialCommerceContactExtractionService $contacts,
        SocialCommerceSellerSignalExtractionService $sellerSignals,
    ): JsonResponse
    {
        $phoneRegion = request()->hasSession()
            ? strtoupper((string) data_get(request()->session()->get('user_session_country'), 'iso_alpha2', ''))
            : '';
        $contactCandidates = $contacts->extract(
            implode("\n", array_filter([$preview->title, $preview->description, $preview->site_name])),
            $phoneRegion ?: null,
        );
        $sellerIdentity = $sellerSignals->extract([
            'title' => $preview->title,
            'description' => $preview->description,
            'site_name' => $preview->site_name,
        ], (string) $preview->external_platform);

        return response()->json([
            'id' => $preview->id,
            'status' => $preview->status,
            'provenance' => $preview->preview_provenance,
            'failure_reason' => $preview->failure_reason,
            'platform' => $preview->external_platform,
            'external_post_id' => $preview->external_post_id,
            'seller_identity' => $sellerIdentity,
            'preview' => [
                'title' => $preview->title,
                'description' => $preview->description,
                'site_name' => $preview->site_name,
                'image_url' => $preview->image_url ?: $preview->remote_image_url,
                'contact_candidates' => $contactCandidates,
                'seller_identity' => $sellerIdentity,
            ],
            'contact_candidates' => $contactCandidates,
        ]);
    }
}
