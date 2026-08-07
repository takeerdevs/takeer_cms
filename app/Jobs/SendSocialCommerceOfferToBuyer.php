<?php

namespace App\Jobs;

use App\Models\SocialCommerceRequest;
use App\Services\SocialCommerceNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendSocialCommerceOfferToBuyer implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 3;
    public array $backoff = [15, 60, 180];
    public function __construct(public int $requestId) {}
    public function handle(SocialCommerceNotificationService $notifications): void
    {
        $request = SocialCommerceRequest::query()->with(['buyer', 'claimedMerchant'])->find($this->requestId);
        if (!$request || !$request->buyer?->phone_number || !$request->offer_snapshot) return;
        $url = rtrim((string) config('app.url'), '/') . '/social-commerce/requests/' . $request->public_id . '/offer';
        $notifications->sendOffer($request, $request->buyer->phone_number, $request->offer_snapshot, $url);
    }
}
