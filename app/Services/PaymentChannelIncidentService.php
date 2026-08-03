<?php

namespace App\Services;

use App\Models\MarketplaceSellerPaymentProfile;
use App\Models\Merchant;
use App\Models\PaymentChannelIncident;
use App\Models\PaymentProviderChannel;
use App\Models\PulseNotification;

class PaymentChannelIncidentService
{
    public function openIncident(PaymentProviderChannel $channel, array $payload): PaymentChannelIncident
    {
        $incident = PaymentChannelIncident::query()->create([
            'payment_provider_channel_id' => $channel->id,
            'severity' => $payload['severity'] ?? 'minor',
            'status' => $payload['status'] ?? 'investigating',
            'title' => $payload['title'] ?? "{$channel->name} issue",
            'message' => $payload['message'] ?? null,
            'started_at' => $payload['started_at'] ?? now(),
            'metadata' => $payload['metadata'] ?? [],
        ]);

        if ($payload['notify_affected_merchants'] ?? true) {
            $this->notifyAffectedMerchants($incident);
        }

        return $incident->fresh('channel.provider');
    }

    public function notifyAffectedMerchants(PaymentChannelIncident $incident): array
    {
        $incident->loadMissing('channel.provider');
        $channel = $incident->channel;

        $merchantIds = MarketplaceSellerPaymentProfile::query()
            ->where('payment_provider_id', $channel->payment_provider_id)
            ->whereIn('status', ['active', 'pending_verification'])
            ->pluck('merchant_id')
            ->merge(Merchant::query()
                ->whereHas('orders.settlement', fn ($query) => $query->where('payment_provider_id', $channel->payment_provider_id))
                ->pluck('id'))
            ->filter()
            ->unique()
            ->values();

        $notified = [];

        foreach ($merchantIds as $merchantId) {
            $merchant = Merchant::query()->with('user')->find($merchantId);
            if (! $merchant?->user_id) {
                continue;
            }

            PulseNotification::query()->updateOrCreate(
                ['dedupe_key' => "payment-channel-incident:{$incident->id}:merchant:{$merchant->id}"],
                [
                    'user_id' => $merchant->user_id,
                    'merchant_id' => $merchant->id,
                    'subject_type' => PaymentChannelIncident::class,
                    'subject_id' => $incident->id,
                    'event_type' => 'payment_channel_incident',
                    'icon' => 'credit-card',
                    'tone' => $incident->severity === 'major' ? 'red' : 'amber',
                    'eyebrow' => 'Provider issue',
                    'title' => $incident->title,
                    'body' => $incident->message ?: "We are currently experiencing issues with {$channel->name}.",
                    'meta' => trim(($channel->provider?->name ?: 'Provider') . ' · ' . $channel->country_code . ' · ' . strtoupper($channel->method)),
                    'href' => "/merchant/{$merchant->username}/overview",
                    'status' => $incident->status,
                    'payload' => [
                        'payment_provider_channel_id' => $channel->id,
                        'payment_provider_channel_key' => $channel->key,
                    ],
                    'occurred_at' => now(),
                ]
            );

            $notified[] = $merchant->id;
        }

        $incident->update(['notified_merchant_ids' => $notified]);

        return $notified;
    }

    public function resolveIncident(PaymentChannelIncident $incident): PaymentChannelIncident
    {
        $incident->update([
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        return $incident->fresh('channel.provider');
    }
}
