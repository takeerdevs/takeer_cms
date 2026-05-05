<?php

namespace App\Console\Commands;

use App\Models\MarketingEvent;
use App\Models\MerchantAbandonedCheckoutAutomation;
use App\Models\MerchantAbandonedCheckoutRecovery;
use App\Models\MerchantSmsBalance;
use App\Models\NotificationLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DispatchAbandonedCheckoutRecoveries extends Command
{
    protected $signature = 'marketing:abandoned-checkouts-dispatch {--limit=50 : Maximum checkout events to process}';

    protected $description = 'Send simulated SMS recovery messages for abandoned checkouts.';

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $sent = 0;
        $skipped = 0;

        $automations = MerchantAbandonedCheckoutAutomation::query()
            ->where('is_enabled', true)
            ->with('merchant:id')
            ->get();

        foreach ($automations as $automation) {
            $events = MarketingEvent::query()
                ->where('merchant_id', $automation->merchant_id)
                ->where('event_type', 'checkout_started')
                ->whereNull('order_id')
                ->whereNotNull('user_id')
                ->where('created_at', '<=', now()->subMinutes((int) $automation->delay_minutes))
                ->where('created_at', '>=', now()->subDays((int) $automation->max_age_days))
                ->whereDoesntHave('user', fn ($query) => $query->whereNull('phone_number')->orWhere('phone_number', ''))
                ->whereDoesntHave('order')
                ->whereNotExists(function ($query) use ($automation) {
                    $query->selectRaw('1')
                        ->from('merchant_abandoned_checkout_recoveries')
                        ->whereColumn('merchant_abandoned_checkout_recoveries.marketing_event_id', 'marketing_events.id')
                        ->where('merchant_abandoned_checkout_recoveries.automation_id', $automation->id);
                })
                ->with('user:id,name,phone_number')
                ->oldest()
                ->limit($limit)
                ->get();

            foreach ($events as $event) {
                try {
                    $this->sendRecovery($automation, $event);
                    $sent++;
                } catch (\Throwable $error) {
                    $skipped++;
                    $this->warn("Abandoned checkout event {$event->id} skipped: {$error->getMessage()}");
                }
            }

            $automation->update(['last_run_at' => now()]);
        }

        $this->info("Processed abandoned checkout recoveries: {$sent} sent, {$skipped} skipped.");

        return self::SUCCESS;
    }

    private function sendRecovery(MerchantAbandonedCheckoutAutomation $automation, MarketingEvent $event): void
    {
        DB::transaction(function () use ($automation, $event) {
            $event->refresh();
            $phone = $event->user?->phone_number;
            if (!$phone) {
                throw new \RuntimeException('No phone number available.');
            }

            $balance = MerchantSmsBalance::query()->firstOrCreate(['merchant_id' => $automation->merchant_id]);
            if ($balance->credits < 1) {
                throw new \RuntimeException('Not enough SMS credits.');
            }

            $message = $automation->message;
            if ($automation->coupon_code && !str_contains($message, $automation->coupon_code)) {
                $message .= ' Tumia code '.$automation->coupon_code.'.';
            }

            $log = NotificationLog::query()->create([
                'user_id' => $event->user_id,
                'channel' => 'sms',
                'recipient' => $phone,
                'phone' => $phone,
                'message' => $message,
                'status' => 'sent',
                'gateway' => 'simulated',
                'metadata' => [
                    'purpose' => 'abandoned_checkout_recovery',
                    'automation_id' => $automation->id,
                    'marketing_event_id' => $event->id,
                    'coupon_code' => $automation->coupon_code,
                ],
            ]);

            MerchantAbandonedCheckoutRecovery::query()->create([
                'automation_id' => $automation->id,
                'marketing_event_id' => $event->id,
                'user_id' => $event->user_id,
                'notification_log_id' => $log->id,
                'phone' => $phone,
                'status' => 'sent',
                'sent_at' => now(),
            ]);

            $balance->decrement('credits');
            $balance->increment('lifetime_used');
        });
    }
}
