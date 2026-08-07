<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialCommerceRequestResource;
use App\Events\SocialCommerceRequestClosed;
use App\Models\SocialCommerceRequest;
use App\Services\SocialCommerceAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminSocialCommerceRequestController extends Controller
{
    private function assertAdmin(Request $request): void
    {
        abort_unless((bool) $request->user()?->is_admin || $request->user()?->role === 'admin', 403);
    }

    public function index(Request $request): JsonResponse
    {
        $this->assertAdmin($request);
        $query = SocialCommerceRequest::query()->with(['buyer', 'claimedMerchant', 'product', 'order'])->latest();
        if ($request->filled('status')) $query->where('status', $request->string('status'));
        if ($request->filled('platform')) $query->where('platform', $request->string('platform'));
        return response()->json(SocialCommerceRequestResource::collection($query->paginate(30)));
    }

    public function show(Request $request, SocialCommerceRequest $socialRequest): SocialCommerceRequestResource
    {
        $this->assertAdmin($request);
        return new SocialCommerceRequestResource($socialRequest->load(['buyer', 'claimedMerchant', 'product', 'order', 'linkPreview', 'invitations', 'events']));
    }

    public function block(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceAuditService $audit): SocialCommerceRequestResource
    {
        $this->assertAdmin($request);
        $data = $request->validate(['reason' => ['required', 'string', 'max:120']]);
        if ($socialRequest->order_id) throw ValidationException::withMessages(['request' => 'Converted requests cannot be blocked from this console.']);
        $locked = $audit->transition($socialRequest, SocialCommerceRequest::BLOCKED, 'social_request_blocked', $request, $request->user()->id, 'admin', ['reason' => $data['reason']]);
        $locked->update(['closed_reason' => $data['reason']]);
        event(new SocialCommerceRequestClosed($locked->fresh()));
        return new SocialCommerceRequestResource($locked);
    }

    public function resend(Request $request, SocialCommerceRequest $socialRequest): JsonResponse
    {
        $this->assertAdmin($request);
        $data = $request->validate(['reason' => ['required', 'string', 'max:120']]);
        app(SocialCommerceAuditService::class)->record($socialRequest, 'support_resend_requested', $socialRequest->status, $socialRequest->status, $request, $request->user()->id, 'admin', 'internal', ['reason' => $data['reason']]);
        return response()->json(['message' => 'Use the buyer-approved invitation channels to create a new invitation.']);
    }

    public function revokeClaim(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceAuditService $audit): SocialCommerceRequestResource
    {
        $this->assertAdmin($request);
        $data = $request->validate(['reason' => ['required', 'string', 'max:120']]);
        if ($socialRequest->order_id || !in_array($socialRequest->status, [SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING, SocialCommerceRequest::PRODUCT_SETUP, SocialCommerceRequest::OFFER_READY], true)) {
            throw ValidationException::withMessages(['request' => 'Only pre-order claims can be revoked.']);
        }
        $locked = $audit->transition($socialRequest, SocialCommerceRequest::BLOCKED, 'support_claim_revoked', $request, $request->user()->id, 'admin', ['reason' => $data['reason']]);
        $locked->update(['closed_reason' => 'claim_revoked:' . $data['reason']]);
        event(new SocialCommerceRequestClosed($locked->fresh()));
        return new SocialCommerceRequestResource($locked);
    }
}
