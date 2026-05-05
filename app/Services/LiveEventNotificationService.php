<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class LiveEventNotificationService
{
    public function __construct(private readonly PlatformNotificationService $notifications)
    {
    }

    public function logDueReminders(?Carbon $now = null): array
    {
        $now ??= now();

        return [
            '24h' => $this->logReminderWindow($now, '24h', $now->copy()->addHours(23), $now->copy()->addHours(25)),
            '1h' => $this->logReminderWindow($now, '1h', $now->copy()->addMinutes(45), $now->copy()->addMinutes(75)),
        ];
    }

    private function logReminderWindow(Carbon $now, string $window, Carbon $from, Carbon $to): int
    {
        $count = 0;

        Product::query()
            ->with('merchant')
            ->where('type', 'digital')
            ->where('digital_delivery_type', 'live_event')
            ->whereNotNull('live_event_starts_at')
            ->whereBetween('live_event_starts_at', [$from, $to])
            ->chunkById(100, function (Collection $events) use (&$count, $window, $now) {
                foreach ($events as $event) {
                    foreach ($this->paidBuyersForEvent($event) as $buyer) {
                        $count += $this->dispatchReminder($buyer, $event, $window, $now);
                    }
                }
            });

        return $count;
    }

    private function paidBuyersForEvent(Product $event): Collection
    {
        $buyerIds = Order::query()
            ->where('product_id', $event->id)
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->where(function ($query): void {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->pluck('buyer_id')
            ->filter()
            ->unique()
            ->values();

        if ($buyerIds->isEmpty()) {
            return collect();
        }

        return User::query()
            ->whereIn('id', $buyerIds)
            ->get();
    }

    private function dispatchReminder(User $buyer, Product $event, string $window, Carbon $now): int
    {
        $startsAt = $event->live_event_starts_at
            ? $event->live_event_starts_at->timezone($event->live_event_timezone ?: config('app.timezone', 'Africa/Dar_es_Salaam'))
            : null;

        $message = sprintf(
            'Takeer: "%s" inaanza %s. Fungua access yako hapa: %s',
            $event->title,
            $startsAt ? $startsAt->format('d/m/Y H:i') : 'karibuni',
            $this->eventUrl($event)
        );

        if ($window === '1h' && $event->live_event_access_url) {
            $message .= ' Link ya kujiunga ipo ndani baada ya kufungua bidhaa.';
        }

        $logs = $this->notifications->dispatchToUser($buyer, [
            'channels' => ['sms', 'whatsapp', 'email'],
            'subject' => $window === '24h' ? 'Takeer: Event yako inaanza kesho' : 'Takeer: Event yako inaanza hivi karibuni',
            'message' => $message,
            'dedupe_key' => "live_event.reminder:{$event->id}:{$buyer->id}:{$window}",
            'metadata' => [
                'kind' => 'live_event.reminder',
                'reminder_window' => $window,
                'product_id' => $event->id,
                'product_slug' => $event->slug,
                'product_title' => $event->title,
                'starts_at' => $event->live_event_starts_at?->toISOString(),
                'generated_at' => $now->toISOString(),
                'event_url' => $this->eventUrl($event),
            ],
        ]);

        return $logs->count();
    }

    private function eventUrl(Product $event): string
    {
        return rtrim((string) config('app.url'), '/') . '/product/' . ($event->slug ?: $event->id);
    }
}
