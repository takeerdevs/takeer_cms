<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SocialCommerceRequestResource;
use App\Models\SocialCommerceRequest;
use App\Models\UserAddress;
use App\Services\SocialCommerceInvitationService;
use App\Services\SocialCommerceContactExtractionService;
use App\Services\SocialCommerceOrderConversionService;
use App\Services\SocialCommercePreviewService;
use App\Services\SocialCommerceRequestService;
use App\Services\SocialCommerceSellerMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class SocialCommerceRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $requests = SocialCommerceRequest::query()->where('buyer_id', $request->user()->id)->with(['claimedMerchant', 'product', 'invitations'])->latest()->paginate(20);
        return response()->json(SocialCommerceRequestResource::collection($requests));
    }

    public function store(
        Request $request,
        SocialCommerceRequestService $requests,
        SocialCommercePreviewService $previews,
        SocialCommerceContactExtractionService $contacts,
        SocialCommerceSellerMatchService $sellerMatches,
    ): JsonResponse
    {
        $data = $request->validate([
            'original_url' => ['required', 'string', 'url:http,https', 'max:2048'],
            'idempotency_key' => ['required', 'string', 'max:120'],
            'external_seller_handle' => ['nullable', 'string', 'max:255'],
            'external_seller_name' => ['nullable', 'string', 'max:255'],
            'external_seller_profile_url' => ['nullable', 'url:http,https', 'max:2048'],
            'buyer_screenshot' => ['nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'buyer_product_note' => ['nullable', 'string', 'max:5000'],
            'buyer_variant_note' => ['nullable', 'string', 'max:2000'],
            'requested_quantity' => ['required', 'numeric', 'min:0.001', 'max:100000'],
            'observed_unit_price' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'observed_currency_code' => ['nullable', 'string', 'max:12'],
            'destination_summary' => ['nullable', 'string', 'max:255'],
            'preferred_delivery_type' => ['nullable', 'string', 'max:40'],
            'destination_country_id' => ['nullable', 'integer', 'exists:countries,id'],
            'destination_state_id' => ['nullable', 'integer', 'exists:country_states,id'],
            'destination_city_id' => ['nullable', 'integer', 'exists:country_cities,id'],
            'delivery_context' => ['nullable', 'array'],
            'delivery_address' => ['nullable', 'string', 'min:3', 'max:2000'],
            'user_address_id' => ['nullable', 'integer', 'exists:user_addresses,id'],
            'seller_phone' => ['required', 'string', 'max:40'],
            'seller_phone_region' => ['nullable', 'string', 'regex:/^[A-Za-z]{2}$/'],
            'seller_phone_source' => ['required', 'string', 'max:40', 'in:public_post,buyer_entered,buyer_confirmed'],
            'seller_contact_attested' => ['accepted'],
        ]);

        $sessionRegion = $request->hasSession()
            ? strtoupper((string) data_get($request->session()->get('user_session_country'), 'iso_alpha2', ''))
            : '';
        $phoneRegion = strtoupper((string) ($data['seller_phone_region'] ?? '')) ?: $sessionRegion;
        $normalizedPhone = $contacts->normalize($data['seller_phone'], $phoneRegion ?: null);

        if ($normalizedPhone === null) {
            throw ValidationException::withMessages([
                'seller_phone' => 'Enter a valid international seller phone number, for example +447911123456.',
            ]);
        }

        $data['seller_phone'] = $normalizedPhone['normalized'];
        $data['seller_phone_region'] = $normalizedPhone['country_iso2'];

        // Never trust an address ID or exact address supplied by the browser.
        // Resolve saved addresses against the authenticated buyer and keep the
        // exact location in the request's encrypted delivery context.
        if (!empty($data['user_address_id'])) {
            $savedAddress = UserAddress::query()
                ->whereKey($data['user_address_id'])
                ->where('user_id', $request->user()->id)
                ->with(['country', 'state', 'cityRecord'])
                ->first();

            if (!$savedAddress) {
                return response()->json(['message' => 'Anuani uliyochagua haipatikani kwenye akaunti yako.'], 422);
            }

            $data['delivery_context'] = [
                'source' => 'saved_address',
                'address_id' => $savedAddress->id,
                'address_line' => $savedAddress->address_line,
                'extra_details' => $savedAddress->extra_details,
                'latitude' => $savedAddress->latitude,
                'longitude' => $savedAddress->longitude,
                'country_id' => $savedAddress->country_id,
                'state_id' => $savedAddress->state_id,
                'city_id' => $savedAddress->city_id,
            ];
            $data['delivery_address'] = trim(implode(', ', array_filter([
                $savedAddress->address_line,
                $savedAddress->extra_details,
            ])));
            $data['destination_summary'] = ($data['destination_summary'] ?? '') ?: collect([
                $savedAddress->cityRecord?->name,
                $savedAddress->state?->name,
                $savedAddress->country?->name,
            ])->filter()->join(', ');
        } elseif (!empty($data['delivery_address'])) {
            $data['delivery_context'] = [
                'source' => 'manual',
                'address_line' => trim($data['delivery_address']),
            ];
        }

        $preview = $previews->preview($data['original_url'], ['buyer_id' => $request->user()->id]);
        $socialRequest = $requests->create($request->user(), $data, $preview, $request->file('buyer_screenshot'));
        return response()->json([
            'request' => new SocialCommerceRequestResource($socialRequest),
            'preview' => $preview,
            'seller_match' => $sellerMatches->findFor($socialRequest),
        ], 201);
    }

    public function buyerScreenshot(Request $request, SocialCommerceRequest $socialRequest): Response
    {
        $this->authorize('view', $socialRequest);

        $storedPath = (string) $socialRequest->buyer_screenshot_path;
        abort_unless(str_starts_with($storedPath, 'private://social-commerce/evidence/'), 404);

        $path = ltrim(str_replace('private://', '', $storedPath), '/');
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $mimeType = match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };

        try {
            $disk = Storage::disk('s3');
            if ($disk->exists($path)) {
                return redirect()->away($disk->temporaryUrl($path, now()->addMinutes(15)));
            }
        } catch (\Throwable) {
            // Fall through to the private local disk for development/test environments.
        }

        $local = Storage::disk('local');
        abort_unless($local->exists($path), 404);

        return response()->file($local->path($path), [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'private, max-age=300',
            'Content-Disposition' => 'inline; filename="buyer-product-evidence.' . ($extension ?: 'bin') . '"',
        ]);
    }

    public function show(Request $httpRequest, SocialCommerceRequest $socialRequest): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        $socialRequest->load(['claimedMerchant', 'product', 'linkPreview', 'invitations', 'events', 'order']);
        return new SocialCommerceRequestResource($socialRequest);
    }

    public function invitation(Request $httpRequest, SocialCommerceRequest $socialRequest, SocialCommerceInvitationService $invitations): JsonResponse
    {
        $this->authorize('view', $socialRequest);
        if ((int) $socialRequest->buyer_id !== (int) $httpRequest->user()->id) abort(403);
        $data = $httpRequest->validate([
            'channel' => ['required', 'string'],
            'recipient' => ['nullable', 'string', 'max:80'],
            'seller_phone_region' => ['nullable', 'string', 'regex:/^[A-Za-z]{2}$/'],
            'seller_contact_attested' => ['nullable', 'boolean'],
        ]);
        $result = $invitations->create($socialRequest, $data, $httpRequest);
        if (($data['channel'] ?? null) === 'sms') {
            $invitation = $result['invitation'];
            $phone = (string) $invitation->recipient_encrypted;
            $message = trim((string) data_get($result, 'message', ''));
            $message .= ' Use this protected Takeer link: ' . $result['claim_url'] . '. Do not request payment outside Takeer.';
            $sent = app(\App\Services\SocialCommerceNotificationService::class)->sendInvitation($socialRequest, $phone, $message, $invitation->dedupe_key);
            app(SocialCommerceInvitationService::class)->markSent($invitation, $sent, null, $sent ? null : 'provider_failed');
        }
        $invitation = $result['invitation'];
        return response()->json(['invitation' => [
            'public_id' => $invitation->public_id,
            'channel' => $invitation->channel,
            'status' => $invitation->status,
            'sent_at' => $invitation->sent_at?->toISOString(),
            'expires_at' => $invitation->expires_at?->toISOString(),
        ], 'claim_url' => $result['claim_url'], 'short_claim_url' => $result['short_claim_url'] ?? null], 201);
    }

    public function cancel(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceRequestService $requests): SocialCommerceRequestResource
    {
        $this->authorize('cancel', $socialRequest);
        return new SocialCommerceRequestResource($requests->cancel($socialRequest, $request->user(), $request));
    }

    public function acceptOffer(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceOrderConversionService $conversion): JsonResponse
    {
        $this->authorize('view', $socialRequest);
        $data = $request->validate([
            'idempotency_key' => ['required', 'string', 'max:120'],
            'accept_terms' => ['required', 'accepted'],
            'physical_address' => ['required', 'string', 'min:3', 'max:2000'],
            'user_address_id' => ['nullable', 'integer', 'exists:user_addresses,id'],
            'payment_phone' => ['nullable', 'string', 'max:40'],
            'buyer_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'buyer_lng' => ['nullable', 'numeric', 'between:-180,180'],
            'customer_city' => ['nullable', 'string', 'max:120'],
            'customer_region' => ['nullable', 'string', 'max:120'],
            'shipping_fee' => ['nullable', 'numeric', 'min:0'],
            'shipping_zone_id' => ['nullable', 'integer', 'exists:shipping_zones,id'],
            'legal_versions' => ['nullable', 'array'],
        ]);
        $order = $conversion->accept($socialRequest, $request->user(), $data, $request);
        return response()->json(['message' => 'Offer accepted. Continue with Takeer PSP payment.', 'order' => [
            'id' => $order->id,
            'public_id' => $order->public_id,
            'payment_status' => $order->payment_status,
            'is_inquiry' => (bool) $order->is_inquiry,
            'inquiry_status' => $order->inquiry_status,
            'total_paid' => (float) $order->total_paid,
            'social_commerce_request_id' => $order->social_commerce_request_id,
        ]], 201);
    }

    public function requestChange(Request $request, SocialCommerceRequest $socialRequest, SocialCommerceRequestService $requests): SocialCommerceRequestResource
    {
        $this->authorize('view', $socialRequest);
        return new SocialCommerceRequestResource($requests->requestChange($socialRequest, $request->user(), $request));
    }
}
