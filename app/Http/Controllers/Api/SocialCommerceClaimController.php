<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialCommerceRequestResource;
use App\Models\SocialCommerceRequestInvitation;
use App\Services\SocialCommerceClaimService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SocialCommerceClaimController extends Controller
{
    public function landing(SocialCommerceRequestInvitation $invitation)
    {
        $invitation->load(['request.linkPreview', 'request.product']);
        $socialRequest = $invitation->request;
        return Inertia::render('SocialCommerce/Claim', [
            'invitation' => [
                'public_id' => $invitation->public_id,
                'expires_at' => $invitation->expires_at?->toISOString(),
                'status' => $invitation->status,
            ],
            'request' => (new SocialCommerceRequestResource($socialRequest))->resolve(),
        ]);
    }

    public function accept(Request $request, SocialCommerceRequestInvitation $invitation, SocialCommerceClaimService $claims): JsonResponse
    {
        $data = $request->validate([
            'claim_token' => ['required', 'string', 'min:64', 'max:256'],
            'merchant_id' => ['nullable', 'integer'],
        ]);
        $socialRequest = $claims->claim($invitation, $data['claim_token'], $request->user(), $data['merchant_id'] ?? null, $request);
        return response()->json(['request' => new SocialCommerceRequestResource($socialRequest), 'next' => $socialRequest->status === 'onboarding' ? 'onboarding' : 'product_setup']);
    }
}
