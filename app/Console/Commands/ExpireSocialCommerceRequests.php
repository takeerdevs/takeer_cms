<?php

namespace App\Console\Commands;

use App\Models\SocialCommerceRequest;
use App\Events\SocialCommerceRequestClosed;
use App\Services\SocialCommerceAuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ExpireSocialCommerceRequests extends Command
{
    protected $signature = 'social-commerce:expire-requests';
    protected $description = 'Expire unclaimed requests and stale social-commerce offers.';
    public function handle(SocialCommerceAuditService $audit): int
    {
        SocialCommerceRequest::query()->whereIn('status', [SocialCommerceRequest::AWAITING_SELLER, SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING, SocialCommerceRequest::PRODUCT_SETUP])->where('expires_at', '<=', now())->orderBy('id')->chunkById(100, function ($requests) use ($audit): void {
            foreach ($requests as $request) {
                DB::transaction(function () use ($request, $audit): void {
                    $locked = SocialCommerceRequest::query()->whereKey($request->id)->lockForUpdate()->first();
                    if (!$locked || $locked->expires_at?->isFuture() || !in_array($locked->status, [SocialCommerceRequest::AWAITING_SELLER, SocialCommerceRequest::CLAIMED, SocialCommerceRequest::ONBOARDING, SocialCommerceRequest::PRODUCT_SETUP], true)) return;
                    $from = $locked->status;
                    $locked->transitionTo(SocialCommerceRequest::EXPIRED);
                    $locked->update(['closed_reason' => 'request_expired']);
                    $audit->record($locked, 'social_request_expired', $from, SocialCommerceRequest::EXPIRED, null, null, 'system', null, ['reason' => 'request_expired']);
                    event(new SocialCommerceRequestClosed($locked->fresh()));
                });
            }
        });
        return self::SUCCESS;
    }
}
