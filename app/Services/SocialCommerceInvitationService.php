<?php

namespace App\Services;

use App\Models\SocialCommerceRequest;
use App\Models\SocialCommerceRequestInvitation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SocialCommerceInvitationService
{
    public function __construct(
        private readonly SocialCommerceAuditService $audit,
        private readonly SocialCommerceContactExtractionService $contacts,
    ) {}

    public function create(SocialCommerceRequest $request, array $data, ?Request $httpRequest = null): array
    {
        if (!config('social_commerce.enabled')) {
            throw ValidationException::withMessages(['feature' => 'Social-commerce invitations are temporarily unavailable.']);
        }
        if (!in_array($request->status, [SocialCommerceRequest::AWAITING_SELLER, SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING, SocialCommerceRequest::PRODUCT_SETUP], true)) {
            throw ValidationException::withMessages(['request' => 'This request is no longer accepting seller invitations.']);
        }

        $channel = (string) ($data['channel'] ?? '');
        if (!in_array($channel, ['share_link', 'copy', 'sms', 'whatsapp', 'instagram_dm', 'facebook_messenger'], true)) {
            throw ValidationException::withMessages(['channel' => 'Unsupported invitation channel.']);
        }

        if ($channel === 'sms' && !config('social_commerce.seller_sms_enabled')) {
            throw ValidationException::withMessages(['channel' => 'Seller SMS invitations are disabled.']);
        }

        $recipient = trim((string) ($data['recipient'] ?? $request->sellerPhone() ?? ''));
        if ($channel === 'sms') {
            if ($recipient === '' || empty($data['seller_contact_attested'])) {
                throw ValidationException::withMessages(['recipient' => 'Confirm that this is the seller business contact before sending SMS.']);
            }

            $normalizedRecipient = $this->contacts->normalize($recipient, $data['seller_phone_region'] ?? null);
            if ($normalizedRecipient === null) {
                throw ValidationException::withMessages(['recipient' => 'Enter a valid international seller phone number before sending SMS.']);
            }
            $recipient = $normalizedRecipient['normalized'];

            if (!$request->seller_contact_attested_at || $request->sellerPhone() !== $recipient) {
                $request->update([
                    'seller_phone_encrypted' => $recipient,
                    'seller_phone_hash' => app(SocialCommerceRequestService::class)->contactHash($recipient),
                    'seller_phone_source' => 'buyer_confirmed',
                    'seller_contact_attested_at' => now(),
                ]);
            }
        }

        $recipientHash = $recipient !== '' ? app(SocialCommerceRequestService::class)->contactHash($recipient) : null;
        if ($recipient !== '' && app(SocialCommerceContactSuppressionService::class)->isSuppressed($recipient)) {
            throw ValidationException::withMessages(['recipient' => 'This seller contact has opted out of Takeer invitations.']);
        }
        return DB::transaction(function () use ($request, $channel, $recipient, $recipientHash, $httpRequest): array {
            $count = $request->invitations()->whereNotIn('status', ['revoked', 'expired'])->count();
            if ($count >= (int) config('social_commerce.max_invites_per_request', 3)) {
                throw ValidationException::withMessages(['invitation' => 'Invitation limit reached for this request.']);
            }

            if ($recipientHash && SocialCommerceRequestInvitation::query()->where('recipient_hash', $recipientHash)->where('created_at', '>=', now()->startOfDay())->whereNotIn('status', ['failed', 'opted_out'])->count() >= (int) config('social_commerce.max_invites_per_contact_per_day', 5)) {
                throw ValidationException::withMessages(['recipient' => 'This seller contact has reached its daily invitation limit.']);
            }

            $plainToken = bin2hex(random_bytes((int) config('social_commerce.claim_token_bytes', 32)));
            $tokenHash = hash('sha256', $plainToken);
            $expiresAt = min($request->expires_at ?: now()->addHours(72), now()->addHours((int) config('social_commerce.request_expiry_hours', 72)));
            $publicId = Str::random(20);
            $claimUrl = rtrim((string) config('app.url'), '/') . '/social-buy/claim/' . $publicId . '#token=' . $plainToken;
            $expiryText = $expiresAt->format('Y-m-d H:i');
            $message = "A customer wants to buy the item in this original social post: {$request->original_url} The customer sent the request through Takeer. Confirm the product, price, stock, and delivery, then use the protected Takeer request link. Do not request payment outside Takeer. Expires {$expiryText}.";

            $isSms = $channel === 'sms';
            $invitation = SocialCommerceRequestInvitation::create([
                'public_id' => $publicId,
                'social_commerce_request_id' => $request->id,
                'channel' => $channel,
                'recipient_encrypted' => $recipient !== '' ? $recipient : null,
                'recipient_hash' => $recipientHash,
                'token_hash' => $tokenHash,
                'status' => $isSms ? 'created' : 'sent',
                'attempt_count' => 0,
                'dedupe_key' => "social-invite:{$request->id}:{$channel}:" . ($recipientHash ?: 'link') . ':' . ($count + 1),
                'message_snapshot' => [
                    'template' => 'seller_invitation',
                    'en' => $message,
                    'sw' => "Mteja anataka kununua bidhaa iliyo kwenye post hii ya awali: {$request->original_url} Ombi limetumwa kupitia Takeer. Thibitisha bidhaa, bei, stock na usafirishaji, kisha tumia link salama ya ombi ya Takeer. Usiombe malipo nje ya Takeer. Link inaisha {$expiryText}.",
                    'invitation_public_id' => $publicId,
                    'expires_at' => $expiresAt->toISOString(),
                ],
                'metadata' => ['request_public_id' => $request->public_id],
                'queued_at' => $isSms ? now() : null,
                'sent_at' => $isSms ? null : now(),
                'expires_at' => $expiresAt,
            ]);

            $this->audit->record($request, 'social_invite_created', $request->status, $request->status, $httpRequest, $request->buyer_id, 'user', $channel, ['invitation_public_id' => $invitation->public_id]);
            if (!$isSms) {
                $this->audit->record($request, 'social_invite_sent', $request->status, $request->status, $httpRequest, $request->buyer_id, 'user', $channel, ['invitation_public_id' => $invitation->public_id]);
            }

            return ['invitation' => $invitation, 'claim_url' => $claimUrl, 'claim_token' => $plainToken, 'message' => $message];
        });
    }

    public function markSent(SocialCommerceRequestInvitation $invitation, bool $success, ?string $providerReference = null, ?string $error = null): void
    {
        $invitation->increment('attempt_count');
        $invitation->forceFill([
            'status' => $success ? 'sent' : 'failed',
            'sent_at' => $success ? now() : null,
            'failed_at' => $success ? null : now(),
            'provider_reference' => $providerReference,
            'metadata' => array_merge($invitation->metadata ?: [], $error ? ['error_code' => $error] : []),
        ])->save();
        if ($invitation->request) {
            $this->audit->record($invitation->request, $success ? 'social_invite_sent' : 'social_invite_failed', $invitation->request->status, $invitation->request->status, null, null, null, $invitation->channel, ['invitation_public_id' => $invitation->public_id, 'error_code' => $error]);
        }
    }
}
