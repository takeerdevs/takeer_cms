<?php

namespace App\Console\Commands;

use App\Models\MerchantSmsBalance;
use App\Models\MerchantSmsCampaign;
use App\Models\MerchantSmsCampaignRecipient;
use App\Models\NotificationLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DispatchScheduledSmsCampaigns extends Command
{
    protected $signature = 'marketing:sms-dispatch-scheduled {--limit=25 : Maximum scheduled campaigns to process}';

    protected $description = 'Dispatch due merchant SMS campaigns using the simulated provider outbox.';

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));

        $campaigns = MerchantSmsCampaign::query()
            ->with('merchant:id,username')
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')
            ->limit($limit)
            ->get();

        $sentCampaigns = 0;
        $failedCampaigns = 0;

        foreach ($campaigns as $campaign) {
            try {
                $this->dispatchCampaign($campaign);
                $sentCampaigns++;
            } catch (\Throwable $error) {
                $campaign->update([
                    'status' => 'failed',
                    'failed_count' => max((int) $campaign->failed_count, (int) $campaign->estimated_recipients),
                    'metadata' => array_merge($campaign->metadata ?? [], [
                        'provider' => 'simulated',
                        'provider_mode' => 'queued_intent',
                        'last_error' => $error->getMessage(),
                    ]),
                ]);
                $failedCampaigns++;
                $this->warn("Campaign {$campaign->id} failed: {$error->getMessage()}");
            }
        }

        $this->info("Processed {$campaigns->count()} scheduled campaign(s): {$sentCampaigns} sent, {$failedCampaigns} failed.");

        return self::SUCCESS;
    }

    private function dispatchCampaign(MerchantSmsCampaign $campaign): void
    {
        DB::transaction(function () use ($campaign) {
            $campaign->refresh();

            if ($campaign->status !== 'scheduled') {
                return;
            }

            $balance = MerchantSmsBalance::query()->firstOrCreate(['merchant_id' => $campaign->merchant_id]);
            $credits = (int) $campaign->estimated_credits;

            if ($balance->credits < $credits) {
                throw new \RuntimeException('Not enough SMS credits for scheduled campaign.');
            }

            $campaign->update(['status' => 'sending']);

            $sent = 0;
            $campaign->recipients()->where('status', 'pending')->get()->each(function ($recipient) use ($campaign, &$sent) {
                if (! $recipient->tracking_code) {
                    $recipient->forceFill([
                        'tracking_code' => $this->newSmsTrackingCode(),
                        'landing_url' => $this->smsCampaignLandingUrl($campaign),
                    ])->save();
                }
                $message = trim($campaign->message)."\n".url('/sms/t/'.$recipient->tracking_code);
                $log = NotificationLog::query()->create([
                    'user_id' => $recipient->user_id,
                    'channel' => 'sms',
                    'recipient' => $recipient->phone,
                    'phone' => $recipient->phone,
                    'message' => $message,
                    'status' => 'sent',
                    'gateway' => 'simulated',
                    'metadata' => [
                        'campaign_id' => $campaign->id,
                        'campaign_name' => $campaign->name,
                        'scheduled_dispatch' => true,
                        'tracking_code' => $recipient->tracking_code,
                        'tracking_url' => url('/sms/t/'.$recipient->tracking_code),
                    ],
                ]);

                $recipient->update([
                    'status' => 'sent',
                    'notification_log_id' => $log->id,
                    'sent_at' => now(),
                ]);
                $sent++;
            });

            $balance->decrement('credits', $credits);
            $balance->increment('lifetime_used', $credits);
            $campaign->update([
                'status' => 'sent',
                'sent_count' => $sent,
                'failed_count' => 0,
                'sent_at' => now(),
                'metadata' => array_merge($campaign->metadata ?? [], [
                    'provider' => 'simulated',
                    'provider_mode' => 'queued_intent',
                    'dispatched_by' => 'scheduler',
                ]),
            ]);
        });
    }

    private function newSmsTrackingCode(): string
    {
        do {
            $code = 'sms_'.Str::lower(Str::random(24));
        } while (MerchantSmsCampaignRecipient::query()->where('tracking_code', $code)->exists());

        return $code;
    }

    private function smsCampaignLandingUrl(MerchantSmsCampaign $campaign): string
    {
        $merchantPath = '/m/'.$campaign->merchant?->username;

        return match ($campaign->audience_type) {
            'product_buyers' => $campaign->audience_ref_id ? '/product/'.$campaign->audience_ref_id : $merchantPath,
            'subscription_members' => $campaign->audience_ref_id ? '/plan/'.$campaign->audience_ref_id : $merchantPath,
            default => $merchantPath,
        };
    }
}
