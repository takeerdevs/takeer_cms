<?php

namespace App\Services;

use App\Models\ServiceRequest;
use App\Models\ServiceRequestNotification;
use Illuminate\Support\Facades\URL;

class ServiceRequestNotificationService
{
    public function preparePaymentLink(ServiceRequest $serviceRequest, array $channels = []): array
    {
        $serviceRequest->loadMissing('product');

        if (!$serviceRequest->payment_token || !$serviceRequest->quoted_amount) {
            throw new \RuntimeException('Payment link is not ready for this service request.');
        }

        $channels = $channels ?: $this->defaultChannels($serviceRequest);
        $subject = 'Takeer service payment link';

        return collect($channels)
            ->unique()
            ->map(function (string $channel) use ($serviceRequest, $subject) {
                $recipient = $this->recipientFor($serviceRequest, $channel);
                $payload = [
                    'recipient' => $recipient,
                    'subject' => $channel === 'email' ? $subject : null,
                    'message' => $this->paymentMessage($serviceRequest, $channel),
                    'status' => $recipient ? 'pending' : 'skipped',
                    'provider' => $this->providerFor($channel),
                    'error_message' => $recipient ? null : 'Missing recipient for channel.',
                    'metadata' => [
                        'kind' => 'service_payment_link',
                        'payment_url' => $this->paymentUrl($serviceRequest),
                        'quoted_amount' => (float) $serviceRequest->quoted_amount,
                    ],
                    'prepared_at' => now(),
                ];

                $notification = ServiceRequestNotification::query()
                    ->where('service_request_id', $serviceRequest->id)
                    ->where('channel', $channel)
                    ->whereIn('status', ['pending', 'skipped'])
                    ->latest()
                    ->first();

                if ($notification) {
                    $notification->update($payload);

                    return $notification->refresh();
                }

                return ServiceRequestNotification::create([
                    'service_request_id' => $serviceRequest->id,
                    'channel' => $channel,
                    ...$payload,
                ]);
            })
            ->values()
            ->all();
    }

    public function paymentUrl(ServiceRequest $serviceRequest): string
    {
        return URL::to("/service-requests/{$serviceRequest->public_id}/pay/{$serviceRequest->payment_token}");
    }

    public function paymentMessage(ServiceRequest $serviceRequest, string $channel = 'sms'): string
    {
        $title = $serviceRequest->product?->title ?: 'service';
        $amount = number_format((float) $serviceRequest->quoted_amount);
        $url = $this->paymentUrl($serviceRequest);

        if ($channel === 'email') {
            return "Hello {$serviceRequest->customer_name},\n\nYour quote for {$title} is TZS {$amount}.\n\nYou can pay using this secure Takeer link:\n{$url}\n\nThank you.";
        }

        return "Takeer: Quote yako ya {$title} ni TZS {$amount}. Lipia hapa: {$url}";
    }

    private function defaultChannels(ServiceRequest $serviceRequest): array
    {
        $channels = [];
        if ($serviceRequest->customer_phone) {
            $channels[] = 'sms';
            $channels[] = 'whatsapp';
        }
        if ($serviceRequest->customer_email) {
            $channels[] = 'email';
        }

        return $channels ?: ['sms', 'whatsapp'];
    }

    private function recipientFor(ServiceRequest $serviceRequest, string $channel): ?string
    {
        return match ($channel) {
            'sms', 'whatsapp' => $serviceRequest->customer_phone,
            'email' => $serviceRequest->customer_email,
            default => null,
        };
    }

    private function providerFor(string $channel): string
    {
        return match ($channel) {
            'sms' => config('services.service_messaging.sms_provider', 'pending'),
            'whatsapp' => config('services.service_messaging.whatsapp_provider', 'pending'),
            'email' => config('services.service_messaging.email_provider', 'pending'),
            default => 'pending_provider',
        };
    }
}
