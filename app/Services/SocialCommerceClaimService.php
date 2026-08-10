<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\SocialCommerceRequest;
use App\Models\SocialCommerceRequestInvitation;
use App\Models\User;
use App\Events\SocialCommerceSellerClaimed;
use App\Events\SocialCommerceRequestClosed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SocialCommerceClaimService
{
    public function __construct(private readonly SocialCommerceAuditService $audit) {}

    public function claim(SocialCommerceRequestInvitation $invitation, string $plainToken, User $user, ?int $merchantId, ?Request $httpRequest = null): SocialCommerceRequest
    {
        if (!$user->phone_verified_at) {
            throw ValidationException::withMessages(['seller' => 'Verify your phone before accepting a customer request.']);
        }

        return DB::transaction(function () use ($invitation, $plainToken, $user, $merchantId, $httpRequest): SocialCommerceRequest {
            $lockedInvitation = SocialCommerceRequestInvitation::query()->whereKey($invitation->id)->lockForUpdate()->firstOrFail();
            $request = SocialCommerceRequest::query()->whereKey($lockedInvitation->social_commerce_request_id)->lockForUpdate()->firstOrFail();

            if (!$lockedInvitation->isClaimable($plainToken)) {
                throw ValidationException::withMessages(['claim_token' => 'This invitation is invalid, expired, or already used.']);
            }

            if (!in_array($request->status, [SocialCommerceRequest::AWAITING_SELLER, SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING, SocialCommerceRequest::PRODUCT_SETUP], true)) {
                throw ValidationException::withMessages(['request' => 'This request is no longer available.']);
            }

            $merchant = Merchant::query()->where('user_id', $user->id)->where('is_active', true)->where('is_suspended', false)->when($merchantId, fn ($query) => $query->whereKey($merchantId))->first();
            if (!$merchant) {
                throw ValidationException::withMessages(['merchant_id' => 'Choose an active merchant profile that you own.']);
            }

            if ($request->claimed_merchant_id && (int) $request->claimed_merchant_id !== (int) $merchant->id) {
                throw ValidationException::withMessages(['request' => 'This request has already been claimed by another merchant.']);
            }

            $from = $request->status;
            if ($request->status === SocialCommerceRequest::AWAITING_SELLER) {
                $request->transitionTo(SocialCommerceRequest::CLAIMED);
                $request->save();
                $this->audit->record($request, 'social_seller_claimed', $from, SocialCommerceRequest::CLAIMED, $httpRequest, $user->id, 'user', $lockedInvitation->channel, [
                    'merchant_id' => $merchant->id,
                    'invitation_public_id' => $lockedInvitation->public_id,
                ]);
                $from = SocialCommerceRequest::CLAIMED;
            }
            $next = $merchant->canSellProducts() ? SocialCommerceRequest::PRODUCT_SETUP : SocialCommerceRequest::ONBOARDING;
            if ($from !== $next) {
                $request->transitionTo($next);
            }
            $request->forceFill([
                'claimed_merchant_id' => $merchant->id,
                'claim_started_at' => $request->claim_started_at ?: now(),
                'claimed_at' => $request->claimed_at ?: now(),
                'expires_at' => now()->addDays((int) config('social_commerce.claimed_onboarding_grace_days', 7)),
                'lock_version' => (int) $request->lock_version + 1,
            ])->save();

            $lockedInvitation->forceFill(['status' => 'claimed', 'claimed_at' => now(), 'clicked_at' => $lockedInvitation->clicked_at ?: now()])->save();
            $request->invitations()->where('id', '!=', $lockedInvitation->id)->whereIn('status', ['created', 'queued', 'sent', 'clicked'])->update(['status' => 'revoked', 'revoked_at' => now()]);

            $this->audit->record($request, 'social_seller_claim_eligibility_checked', $from, $next, $httpRequest, $user->id, 'user', $lockedInvitation->channel, [
                'merchant_id' => $merchant->id,
                'invitation_public_id' => $lockedInvitation->public_id,
                'merchant_eligible' => $merchant->canSellProducts(),
            ]);

            $claimed = $request->fresh(['claimedMerchant', 'buyer', 'linkPreview', 'invitations', 'events']);
            event(new SocialCommerceSellerClaimed($claimed));
            return $claimed;
        });
    }

    public function recordClick(SocialCommerceRequestInvitation $invitation): void
    {
        if ($invitation->status === 'sent') {
            $invitation->update(['status' => 'clicked', 'clicked_at' => now()]);
            $this->audit->record($invitation->request, 'social_invite_clicked', $invitation->request->status, $invitation->request->status, null, null, null, $invitation->channel);
        }
    }

    public function dismiss(SocialCommerceRequestInvitation $invitation, string $plainToken, ?Request $httpRequest = null): SocialCommerceRequest
    {
        [$dismissed, $evidencePath] = DB::transaction(function () use ($invitation, $plainToken, $httpRequest): array {
            $lockedInvitation = SocialCommerceRequestInvitation::query()->whereKey($invitation->id)->lockForUpdate()->firstOrFail();
            $socialRequest = SocialCommerceRequest::query()->whereKey($lockedInvitation->social_commerce_request_id)->lockForUpdate()->firstOrFail();

            if (!$lockedInvitation->isClaimable($plainToken)) {
                throw ValidationException::withMessages(['claim_token' => 'This invitation is invalid, expired, or already used.']);
            }

            if ($socialRequest->status !== SocialCommerceRequest::AWAITING_SELLER) {
                throw ValidationException::withMessages(['request' => 'This request can no longer be dismissed from this invitation.']);
            }

            $from = $socialRequest->status;
            $evidencePath = (string) $socialRequest->buyer_screenshot_path;
            $socialRequest->transitionTo(SocialCommerceRequest::DECLINED);
            $socialRequest->forceFill([
                'original_url' => 'redacted://seller-dismissed',
                'normalized_url' => 'redacted://seller-dismissed',
                'preview_snapshot' => null,
                'buyer_screenshot_path' => null,
                'status' => SocialCommerceRequest::DECLINED,
                'declined_at' => now(),
                'closed_reason' => 'seller_not_listing',
                'lock_version' => (int) $socialRequest->lock_version + 1,
            ])->save();

            $socialRequest->invitations()->whereIn('status', ['created', 'queued', 'sent', 'clicked'])->update([
                'status' => 'revoked',
                'revoked_at' => now(),
            ]);

            $this->audit->record($socialRequest, 'social_request_dismissed_by_recipient', $from, SocialCommerceRequest::DECLINED, $httpRequest, null, 'invitation_recipient', $lockedInvitation->channel, [
                'reason' => 'seller_not_listing',
                'invitation_public_id' => $lockedInvitation->public_id,
                'evidence_removed' => $evidencePath !== '',
            ]);

            return [$socialRequest->fresh(), $evidencePath];
        });

        if (str_starts_with($evidencePath, 'private://')) {
            $path = ltrim(str_replace('private://', '', $evidencePath), '/');
            foreach (['s3', 'local'] as $disk) {
                try {
                    Storage::disk($disk)->delete($path);
                } catch (\Throwable) {
                    // The database reference is already cleared; retention cleanup can retry any remote failure.
                }
            }
        }

        event(new SocialCommerceRequestClosed($dismissed));

        return $dismissed;
    }
}
