<?php

namespace App\Services;

use App\Models\SocialCommerceRequest;
use App\Models\User;
use App\Events\SocialCommerceRequestClosed;
use App\Events\SocialCommerceRequestSubmitted;
use Illuminate\Http\UploadedFile;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class SocialCommerceRequestService
{
    public function __construct(
        private readonly SocialCommercePreviewService $previewService,
        private readonly SocialCommerceAuditService $audit,
        private readonly MediaUploadService $media,
    ) {}

    public function create(User $buyer, array $data, ?array $preview = null, ?UploadedFile $buyerScreenshot = null): SocialCommerceRequest
    {
        if (!$buyer->phone_verified_at) {
            throw ValidationException::withMessages(['buyer' => 'Verify your phone before submitting a social-commerce request.']);
        }

        if (!config('social_commerce.enabled')) {
            throw ValidationException::withMessages(['feature' => 'Social-commerce requests are temporarily unavailable.']);
        }

        if (blank($data['seller_phone'] ?? null)) {
            throw ValidationException::withMessages(['seller_phone' => 'A seller phone number is required so Takeer can send the order request.']);
        }

        if (empty($data['seller_contact_attested'])) {
            throw ValidationException::withMessages(['seller_contact_attested' => 'Confirm that this phone number belongs to the seller before sending the order request.']);
        }

        $preview ??= $this->previewService->preview((string) $data['original_url']);
        $link = $preview['link'];
        $idempotencyKey = (string) ($data['idempotency_key'] ?? '');
        if ($idempotencyKey === '') {
            throw ValidationException::withMessages(['idempotency_key' => 'An idempotency key is required.']);
        }

        $storedScreenshotPath = null;

        try {
            return DB::transaction(function () use ($buyer, $data, $preview, $link, $idempotencyKey, $buyerScreenshot, &$storedScreenshotPath): SocialCommerceRequest {
                $existing = SocialCommerceRequest::query()->where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing->load(['linkPreview', 'invitations']);
                }

                $duplicate = SocialCommerceRequest::query()
                    ->where('buyer_id', $buyer->id)
                    ->where('url_hash', $link['url_hash'])
                    ->whereIn('status', [SocialCommerceRequest::AWAITING_SELLER, SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING, SocialCommerceRequest::PRODUCT_SETUP, SocialCommerceRequest::OFFER_READY])
                    ->first();
                if ($duplicate) {
                    return $duplicate->load(['linkPreview', 'invitations']);
                }

                $limit = (int) config('social_commerce.max_requests_per_buyer_per_day', 10);
                if (SocialCommerceRequest::query()->where('buyer_id', $buyer->id)->where('created_at', '>=', now()->startOfDay())->count() >= $limit) {
                    throw ValidationException::withMessages(['request' => 'Daily social-commerce request limit reached.']);
                }

                if ($buyerScreenshot) {
                    try {
                        $storedScreenshotPath = $this->media->storeSecurely(
                            $buyerScreenshot,
                            'social-commerce/evidence/' . now()->format('Y/m'),
                        );
                    } catch (Throwable) {
                        throw ValidationException::withMessages([
                            'buyer_screenshot' => 'The product screenshot could not be stored securely. Please try again.',
                        ]);
                    }

                    if (blank($storedScreenshotPath)) {
                        throw ValidationException::withMessages([
                            'buyer_screenshot' => 'The product screenshot could not be stored securely. Please try again.',
                        ]);
                    }
                }

                $sellerPhone = trim((string) ($data['seller_phone'] ?? ''));
                $sellerHandle = strtolower(ltrim(trim((string) ($link['external_seller_handle'] ?? $data['external_seller_handle'] ?? '')), '@'));
                $request = SocialCommerceRequest::create([
                    'buyer_id' => $buyer->id,
                    'platform' => $link['platform'],
                    'original_url' => (string) $data['original_url'],
                    'normalized_url' => $link['normalized_url'],
                    'url_hash' => $link['url_hash'],
                    'external_post_id' => $link['external_post_id'] ?? null,
                    'external_seller_handle' => $sellerHandle !== '' ? $sellerHandle : null,
                    'external_seller_name' => $data['external_seller_name'] ?? null,
                    'external_seller_profile_url' => $link['external_seller_profile_url'] ?? $data['external_seller_profile_url'] ?? null,
                    'link_preview_id' => $preview['link_preview_id'] ?? null,
                    'preview_status' => $preview['status'] ?? 'unavailable',
                    'preview_provenance' => $preview['provenance'] ?? 'unavailable',
                    'preview_snapshot' => $preview['preview'] ?? null,
                    'buyer_screenshot_path' => $storedScreenshotPath ? 'private://' . ltrim($storedScreenshotPath, '/') : null,
                    'buyer_product_note' => $data['buyer_product_note'] ?? null,
                    'buyer_variant_note' => $data['buyer_variant_note'] ?? null,
                    'requested_quantity' => $data['requested_quantity'] ?? 1,
                    'observed_unit_price' => $data['observed_unit_price'] ?? null,
                    'observed_currency_code' => $data['observed_currency_code'] ?? null,
                    'destination_country_id' => $data['destination_country_id'] ?? null,
                    'destination_state_id' => $data['destination_state_id'] ?? null,
                    'destination_city_id' => $data['destination_city_id'] ?? null,
                    'destination_summary' => $data['destination_summary'] ?? null,
                    'delivery_context_encrypted' => $data['delivery_context'] ?? [],
                    'preferred_delivery_type' => $data['preferred_delivery_type'] ?? null,
                    'seller_phone_encrypted' => $sellerPhone !== '' ? $sellerPhone : null,
                    'seller_phone_hash' => $sellerPhone !== '' ? $this->contactHash($sellerPhone) : null,
                    'seller_phone_source' => $data['seller_phone_source'] ?? null,
                    'seller_contact_attested_at' => !empty($data['seller_contact_attested']) ? now() : null,
                    'status' => SocialCommerceRequest::AWAITING_SELLER,
                    'idempotency_key' => $idempotencyKey,
                    'expires_at' => now()->addHours((int) config('social_commerce.request_expiry_hours', 72)),
                ]);

                $this->audit->record($request, 'social_request_created', null, $request->status, null, $buyer->id, 'user', null, [
                    'platform' => $request->platform,
                    'preview_status' => $request->preview_status,
                    'preview_provenance' => $request->preview_provenance,
                ]);
                event(new SocialCommerceRequestSubmitted($request));

                return $request->load(['linkPreview', 'invitations']);
            });
        } catch (Throwable $exception) {
            if ($storedScreenshotPath) {
                try {
                    $this->media->delete('s3', $storedScreenshotPath);
                } catch (Throwable) {
                    // Preserve the original request failure; storage cleanup can be retried separately.
                }
            }

            throw $exception;
        }
    }

    public function cancel(SocialCommerceRequest $request, User $buyer, ?\Illuminate\Http\Request $httpRequest = null): SocialCommerceRequest
    {
        if ((int) $request->buyer_id !== (int) $buyer->id) {
            throw ValidationException::withMessages(['request' => 'You are not allowed to cancel this request.']);
        }

        $cancelled = DB::transaction(fn () => tap(
            $this->audit->transition($request, SocialCommerceRequest::CANCELLED, 'social_request_cancelled', $httpRequest, $buyer->id, 'internal', ['reason' => 'buyer_cancelled']),
            fn (SocialCommerceRequest $locked) => $locked->update(['closed_reason' => 'buyer_cancelled'])
        ));
        event(new SocialCommerceRequestClosed($cancelled->fresh()));
        return $cancelled;
    }

    public function requestChange(SocialCommerceRequest $request, User $buyer, ?\Illuminate\Http\Request $httpRequest = null): SocialCommerceRequest
    {
        if ((int) $request->buyer_id !== (int) $buyer->id || $request->status !== SocialCommerceRequest::OFFER_READY) {
            throw ValidationException::withMessages(['request' => 'This offer cannot be changed.']);
        }

        return DB::transaction(function () use ($request, $buyer, $httpRequest): SocialCommerceRequest {
            $locked = $this->audit->transition($request, SocialCommerceRequest::PRODUCT_SETUP, 'social_offer_change_requested', $httpRequest, $buyer->id, 'internal');
            $locked->update(['offer_snapshot' => null, 'offer_expires_at' => null, 'offer_ready_at' => null]);
            return $locked;
        });
    }

    public function contactHash(string $value): string
    {
        return hash_hmac('sha256', preg_replace('/\s+/', '', $value), (string) config('app.key'));
    }
}
