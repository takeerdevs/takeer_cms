<?php

namespace App\Console\Commands;

use App\Jobs\SendSocialCommerceInviteReminder;
use App\Models\SocialCommerceRequestInvitation;
use Illuminate\Console\Command;

class SendSocialCommerceReminders extends Command
{
    protected $signature = 'social-commerce:send-reminders';
    protected $description = 'Queue reminders for outstanding social-commerce invitations.';
    public function handle(): int
    {
        foreach ((array) config('social_commerce.reminder_hours', [24, 48]) as $hours) {
            SocialCommerceRequestInvitation::query()->whereIn('status', ['sent', 'clicked'])->whereBetween('created_at', [now()->subHours($hours)->subMinutes(10), now()->subHours($hours)->addMinutes(10)])->where('expires_at', '>', now())->each(fn ($invitation) => SendSocialCommerceInviteReminder::dispatch($invitation->id));
        }
        return self::SUCCESS;
    }
}
