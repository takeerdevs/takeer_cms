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

    public function short(string $shortCode)
    {
        $invitation = SocialCommerceRequestInvitation::query()->where('short_code', $shortCode)->firstOrFail();
        abort_if(in_array($invitation->status, ['revoked', 'claimed'], true) || !$invitation->expires_at?->isFuture(), 410);

        $invitation->forceFill(['clicked_at' => $invitation->clicked_at ?: now()])->save();
        $claimUrl = route('social-commerce.claim', ['invitation' => $invitation->public_id]);

        return redirect()->to($claimUrl . '#token=' . rawurlencode($shortCode));
    }

    public function accept(Request $request, SocialCommerceRequestInvitation $invitation, SocialCommerceClaimService $claims): JsonResponse
    {
        $data = $request->validate([
            'claim_token' => ['required', 'string', 'min:16', 'max:256'],
            'merchant_id' => ['nullable', 'integer'],
        ]);
        $socialRequest = $claims->claim($invitation, $data['claim_token'], $request->user(), $data['merchant_id'] ?? null, $request);
        return response()->json(['request' => new SocialCommerceRequestResource($socialRequest), 'next' => $socialRequest->status === 'onboarding' ? 'onboarding' : 'product_setup']);
    }

    public function dismiss(Request $request, SocialCommerceRequestInvitation $invitation, SocialCommerceClaimService $claims): JsonResponse
    {
        $data = $request->validate([
            'claim_token' => ['required', 'string', 'min:16', 'max:256'],
        ]);

        $socialRequest = $claims->dismiss($invitation, $data['claim_token'], $request);

        return response()->json([
            'message' => 'The invitation and retained buyer evidence were removed.',
            'request_status' => $socialRequest->status,
        ]);
    }
}
