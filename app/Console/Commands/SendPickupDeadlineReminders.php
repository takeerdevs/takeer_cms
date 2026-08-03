<?php

namespace App\Console\Commands;

use App\Models\NotificationLog;
use App\Models\Order;
use App\Services\SmsService;
use Illuminate\Console\Command;

class SendPickupDeadlineReminders extends Command
{
    protected $signature = 'orders:send-pickup-reminders {--limit=100 : Maximum orders to inspect in one run}';

    protected $description = 'Send pickup deadline reminders to buyers and merchants before pickup windows expire.';

    public function handle(SmsService $sms): int
    {
        $limit = max(1, (int) $this->option('limit'));

        $orders = Order::query()
            ->with(['buyer:id,phone_number', 'merchant.country', 'merchant.user:id,phone_number', 'delivery:id,order_id,delivery_type'])
            ->whereNotNull('pickup_deadline_at')
            ->where('pickup_deadline_at', '>', now())
            ->whereIn('payment_status', ['pending_fulfillment', 'payment_confirmed'])
            ->whereIn('pickup_status', ['ready_for_pickup', 'extension_requested'])
            ->whereHas('delivery', fn ($query) => $query->where('delivery_type', 'self_pickup'))
            ->orderBy('pickup_deadline_at')
            ->limit($limit)
            ->get();

        $sent = 0;

        foreach ($orders as $order) {
            $minutes = now()->diffInMinutes($order->pickup_deadline_at, false);
            $window = $minutes <= 120 ? '2h' : ($minutes <= 1440 ? '24h' : null);

            if (!$window) {
                continue;
            }

            $deadline = $order->pickup_deadline_at
                ->timezone($order->merchant?->defaultTimezone() ?: config('app.timezone', 'UTC'))
                ->format('M j, Y g:i A');
            $publicId = (string) ($order->public_id ?: $order->id);

            if ($order->buyer?->phone_number && !$this->reminderExists('buyer', $window, $publicId)) {
                $sms->sendPickupDeadlineReminderToBuyer($order->buyer->phone_number, $publicId, $deadline, $window, $order->buyer_id);
                $sent++;
            }

            if ($order->merchant?->user?->phone_number && !$this->reminderExists('merchant', $window, $publicId)) {
                $sms->sendPickupDeadlineReminderToMerchant($order->merchant->user->phone_number, $publicId, $deadline, $window, $order->merchant->user_id);
                $sent++;
            }
        }

        $this->info("Prepared {$sent} pickup reminder notification(s).");

        return self::SUCCESS;
    }

    private function reminderExists(string $recipient, string $window, string $publicId): bool
    {
        return NotificationLog::query()
            ->where('channel', 'sms')
            ->where('dedupe_key', "pickup-reminder-{$recipient}:{$window}:{$publicId}")
            ->whereIn('status', ['sent', 'pending'])
            ->exists();
    }
}
