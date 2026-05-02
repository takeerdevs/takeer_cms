<?php

namespace App\Services;

use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PlatformNotificationService
{
    public const CHANNELS = ['sms', 'whatsapp', 'email'];

    /**
     * Create one notification outbox entry per channel for a known platform user.
     *
     * Provider calls are intentionally centralized here. Today this method creates
     * pending logs; Beem, WhatsApp Business, and email delivery can be connected
     * inside sendViaProvider() without touching feature controllers.
     */
    public function dispatchToUser(User $target, array $payload): Collection
    {
        $channels = $this->normalizeChannels($payload['channels'] ?? []);
        if ($channels === []) {
            $channels = $this->availableChannelsFor($target);
        }

        $subject = trim((string) ($payload['subject'] ?? 'Takeer notification'));
        $message = trim((string) ($payload['message'] ?? ''));
        $metadata = $payload['metadata'] ?? [];
        $dedupeKey = trim((string) ($payload['dedupe_key'] ?? ''));

        if ($message === '') {
            throw new \InvalidArgumentException('Notification message is required.');
        }

        return collect($channels)->map(function (string $channel) use ($target, $subject, $message, $metadata, $dedupeKey) {
            if ($dedupeKey !== '') {
                $existing = NotificationLog::query()
                    ->where('channel', $channel)
                    ->where('dedupe_key', $dedupeKey)
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            $recipient = $this->recipientFor($target, $channel);

            $log = NotificationLog::create([
                'user_id' => $target->id,
                'channel' => $channel,
                'recipient' => $recipient,
                'phone' => in_array($channel, ['sms', 'whatsapp'], true) ? $recipient : null,
                'email' => $channel === 'email' ? $recipient : null,
                'whatsapp' => $channel === 'whatsapp' ? $recipient : null,
                'subject' => $channel === 'email' ? $subject : null,
                'message' => $message,
                'status' => $recipient ? 'pending' : 'failed',
                'error_message' => $recipient ? null : "Missing {$channel} recipient for target user.",
                'gateway' => $this->providerFor($channel),
                'dedupe_key' => $dedupeKey !== '' ? $dedupeKey : null,
                'metadata' => [
                    ...$metadata,
                    'target_user_id' => $target->id,
                    'target_user_email' => $target->email,
                    'target_user_phone' => $target->phone_number,
                ],
            ]);

            if ($recipient && (bool) ($metadata['send_now'] ?? false)) {
                $this->sendViaProvider($log);
            }

            return $log;
        });
    }

    public function availableChannelsFor(User $target): array
    {
        $channels = [];

        if ($target->phone_number) {
            $channels[] = 'sms';
            $channels[] = 'whatsapp';
        }

        if ($target->email) {
            $channels[] = 'email';
        }

        return $channels;
    }

    private function recipientFor(User $target, string $channel): ?string
    {
        return match ($channel) {
            'sms', 'whatsapp' => $this->normalizePhone($target->phone_number),
            'email' => $target->email,
            default => null,
        };
    }

    private function normalizeChannels(array $channels): array
    {
        return collect($channels)
            ->map(fn ($channel) => Str::lower(trim((string) $channel)))
            ->filter(fn ($channel) => in_array($channel, self::CHANNELS, true))
            ->unique()
            ->values()
            ->all();
    }

    private function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/[^\d]/', '', (string) $phone);
        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '0')) {
            return '255' . substr($digits, 1);
        }

        return $digits;
    }

    private function providerFor(string $channel): string
    {
        return match ($channel) {
            'sms' => config('services.platform_notifications.sms_provider', 'beem_africa'),
            'whatsapp' => config('services.platform_notifications.whatsapp_provider', 'whatsapp_business'),
            'email' => config('services.platform_notifications.email_provider', 'laravel_mail'),
            default => 'pending_provider',
        };
    }

    private function sendViaProvider(NotificationLog $log): void
    {
        if ($log->channel === 'email' && $log->email) {
            Mail::raw($log->message, function ($message) use ($log) {
                $message->to($log->email)->subject($log->subject ?: 'Takeer notification');
            });

            $log->update(['status' => 'sent']);

            return;
        }

        // SMS and WhatsApp providers plug in here later. Until then, the log is
        // the single outbox source for Beem/WhatsApp workers.
    }
}
