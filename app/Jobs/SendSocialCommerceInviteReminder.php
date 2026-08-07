<?php

namespace App\Jobs;

use App\Models\SocialCommerceRequestInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendSocialCommerceInviteReminder implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    public int $tries = 2;
    public function __construct(public int $invitationId) {}
    public function handle(): void
    {
        $invitation = SocialCommerceRequestInvitation::query()->find($this->invitationId);
        if (!$invitation || !in_array($invitation->status, ['sent', 'clicked'], true) || $invitation->expires_at?->isPast()) return;
        SendSocialCommerceSellerInvitation::dispatch($invitation->id);
    }
}
