<?php

namespace App\Jobs;

use App\Models\SocialCommerceRequestInvitation;
use App\Services\SocialCommerceInvitationService;
use App\Services\SocialCommerceNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendSocialCommerceSellerInvitation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 3;
    public array $backoff = [15, 60, 180];
    public function __construct(public int $invitationId) {}

    public function handle(SocialCommerceInvitationService $invitations, SocialCommerceNotificationService $notifications): void
    {
        $invitation = SocialCommerceRequestInvitation::query()->with('request')->find($this->invitationId);
        if (!$invitation || $invitation->channel === 'sms' || $invitation->status === 'sent' || $invitation->status === 'claimed' || $invitation->status === 'revoked') return;
        $phone = (string) ($invitation->recipient_encrypted ?: '');
        $message = (string) data_get($invitation->message_snapshot, 'en', '');
        $success = $phone !== '' && $message !== '' && $notifications->sendInvitation($invitation->request, $phone, $message, $invitation->dedupe_key);
        $invitations->markSent($invitation, $success, null, $success ? null : 'provider_failed');
    }
}
