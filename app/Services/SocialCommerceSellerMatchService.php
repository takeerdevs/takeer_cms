<?php

namespace App\Services;

use App\Models\SocialCommerceRequest;

class SocialCommerceSellerMatchService
{
    public function findFor(SocialCommerceRequest $request): ?array
    {
        $handle = strtolower(ltrim(trim((string) $request->external_seller_handle), '@'));
        $phoneHash = trim((string) $request->seller_phone_hash);

        // Matching is only trusted after the buyer has attested that the
        // number belongs to the seller. A public handle alone is not enough
        // to route a request to an existing merchant account.
        if ($handle === '' || $phoneHash === '' || !$request->seller_contact_attested_at) {
            return null;
        }

        $baseQuery = SocialCommerceRequest::query()
            ->where($request->getKeyName(), '<>', $request->getKey())
            ->where('platform', $request->platform)
            ->whereRaw('LOWER(external_seller_handle) = ?', [$handle])
            ->where('seller_phone_hash', $phoneHash)
            ->whereNotNull('seller_contact_attested_at')
            ->whereNotIn('status', [
                SocialCommerceRequest::CANCELLED,
                SocialCommerceRequest::EXPIRED,
                SocialCommerceRequest::BLOCKED,
            ]);

        $previousRequestCount = (clone $baseQuery)->count();
        if ($previousRequestCount === 0) {
            return null;
        }

        $merchantRequest = (clone $baseQuery)
            ->whereNotNull('claimed_merchant_id')
            ->with('claimedMerchant')
            ->latest('created_at')
            ->first();

        $merchant = $merchantRequest?->claimedMerchant;

        return [
            'matched' => true,
            'match_type' => $merchant ? 'known_takeer_merchant' : 'same_observed_seller',
            'confidence' => 'high',
            'handle' => $handle,
            'previous_request_count' => $previousRequestCount,
            'merchant' => $merchant ? [
                'id' => $merchant->id,
                'display_name' => $merchant->display_name,
                'username' => $merchant->username,
                'is_verified' => (bool) $merchant->is_verified,
                'kyc_status' => $merchant->kyc_status,
            ] : null,
        ];
    }
}
