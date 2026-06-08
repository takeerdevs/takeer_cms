<?php

namespace App\Services;

use App\Models\MerchantPayoutCredential;
use App\Models\PaymentChannelIncident;
use App\Models\PaymentProviderChannel;
use App\Models\PulseNotification;
use App\Models\WithdrawalRequest;

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

        $merchantIds = collect()
            ->merge(MerchantPayoutCredential::query()
                ->where('payment_provider_channel_id', $channel->id)
                ->where('status', 'active')
                ->pluck('merchant_id'))
            ->merge(WithdrawalRequest::query()
                ->where('payment_provider_channel_id', $channel->id)
                ->whereIn('status', ['pending', 'approved'])
                ->pluck('merchant_id'))
            ->filter()
            ->unique()
            ->values();

        $notified = [];

        foreach ($merchantIds as $merchantId) {
            $credential = MerchantPayoutCredential::query()
                ->with('merchant.user')
                ->where('merchant_id', $merchantId)
                ->where('payment_provider_channel_id', $channel->id)
                ->where('status', 'active')
                ->first();

            $merchant = $credential?->merchant ?: \App\Models\Merchant::query()->with('user')->find($merchantId);
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
                    'icon' => 'wallet',
                    'tone' => $incident->severity === 'major' ? 'red' : 'amber',
                    'eyebrow' => 'Payout issue',
                    'title' => $incident->title,
                    'body' => $incident->message ?: "We are currently experiencing issues with {$channel->name}.",
                    'meta' => trim(($channel->provider?->name ?: 'Provider') . ' · ' . $channel->country_code . ' · ' . strtoupper($channel->method)),
                    'href' => "/merchant/{$merchant->username}/wallet",
                    'status' => $incident->status,
                    'payload' => [
                        'payment_provider_channel_id' => $channel->id,
                        'payment_provider_channel_key' => $channel->key,
                        'merchant_payout_credential_id' => $credential?->id,
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
