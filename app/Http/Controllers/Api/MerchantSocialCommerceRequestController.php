<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialCommerceRequestResource;
use App\Models\SocialCommerceRequest;
use App\Services\SocialCommerceOfferService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantSocialCommerceRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $merchantIds = $request->user()->merchantProfiles()->pluck('id');
        $requests = SocialCommerceRequest::query()->whereIn('claimed_merchant_id', $merchantIds)->with(['buyer', 'claimedMerchant', 'product', 'invitations'])->latest()->paginate(20);
        return response()->json(SocialCommerceRequestResource::collection($requests));
    }

    public function show(Request $request, SocialCommerceRequest $socialRequest): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        abort_unless($socialRequest->claimedMerchant?->user_id === $request->user()->id, 403);
        return new SocialCommerceRequestResource($socialRequest->load(['buyer', 'claimedMerchant', 'product', 'linkPreview', 'invitations', 'events']));
    }

    public function matchProduct(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceOfferService $offers): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        $data = $request->validate(['product_id' => ['required', 'integer', 'exists:products,id']]);
        return new SocialCommerceRequestResource($offers->matchProduct($socialRequest, $request->user(), (int) $data['product_id'], $request));
    }

    public function createProduct(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceOfferService $offers): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        $data = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'inventory_count' => ['required', 'integer', 'min:0'],
            'currency_id' => ['nullable', 'integer', 'exists:currencies,id'],
            'fulfillment_mode' => ['nullable', 'string', 'max:80'],
        ]);
        return new SocialCommerceRequestResource($offers->createProduct($socialRequest, $request->user(), $data, $request));
    }

    public function offer(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceOfferService $offers): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        $data = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'quantity' => ['required', 'numeric', 'min:0.001'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'currency_code' => ['nullable', 'string', 'max:12'],
            'delivery_type' => ['nullable', 'string', 'max:40'],
            'destination_summary' => ['nullable', 'string', 'max:255'],
            'delivery_estimate' => ['nullable', 'string', 'max:255'],
            'return_policy' => ['nullable', 'array'],
            'sku' => ['nullable', 'string', 'max:120'],
            'terms_version' => ['nullable', 'string', 'max:80'],
        ]);
        return new SocialCommerceRequestResource($offers->createOffer($socialRequest, $request->user(), $data, $request));
    }

    public function sendOffer(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceOfferService $offers): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        return new SocialCommerceRequestResource($offers->sendOffer($socialRequest, $request->user(), $request));
    }

    public function decline(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceOfferService $offers): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        $data = $request->validate(['reason' => ['required', 'string', 'max:120']]);
        return new SocialCommerceRequestResource($offers->decline($socialRequest, $request->user(), $data['reason'], $request));
    }
}
