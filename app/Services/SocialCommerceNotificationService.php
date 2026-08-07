<?php

namespace App\Services;

use App\Models\SocialCommerceRequest;

class SocialCommerceNotificationService
{
    public function __construct(private readonly SmsService $sms) {}

    public function sendInvitation(SocialCommerceRequest $request, string $phone, string $message, string $dedupeKey): bool
    {
        return $this->sms->sendOnce($dedupeKey, $phone, $message, $request->buyer_id);
    }

    public function sendOffer(SocialCommerceRequest $request, string $phone, array $offer, string $offerUrl): bool
    {
        $amount = number_format((float) ($offer['total'] ?? 0), 2);
        $expiry = (string) ($offer['offer_expires_at'] ?? '');
        $message = "Takeer: {$request->claimedMerchant?->display_name} has confirmed {$offer['product_title']} for {$amount} {$offer['currency_code']}. Review delivery and pay only through this Takeer link: {$offerUrl}. Expires {$expiry}.";
        return $this->sms->sendOnce("social-offer:{$request->id}:" . ($offer['revision'] ?? 1), $phone, $message, $request->buyer_id);
    }
}
