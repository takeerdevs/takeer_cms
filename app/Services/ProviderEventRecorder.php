<?php

namespace App\Services;

use App\Models\PaymentProvider;
use App\Models\ProviderEvent;
use App\Payments\PaymentEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProviderEventRecorder
{
    public function record(Request $request, PaymentEvent $event, bool $signaturePresent, bool $signatureValid): ProviderEvent
    {
        $provider = PaymentProvider::query()->where('key', $event->provider)->firstOrFail();
        $raw = $request->getContent();
        $hash = hash('sha256', $raw);
        $providerEventId = $this->providerEventId($event);
        $replayKey = hash('sha256', implode('|', [
            $provider->id,
            $event->direction,
            $providerEventId ?: $event->providerReference ?: $event->takeerReference ?: $hash,
        ]));

        return ProviderEvent::query()->firstOrCreate(
            ['replay_key' => $replayKey],
            [
                'public_id' => (string) Str::uuid(),
                'payment_provider_id' => $provider->id,
                'direction' => $event->direction,
                'event_type' => $event->status,
                'provider_event_id' => $providerEventId,
                'provider_transaction_reference' => $event->providerReference,
                'takeer_reference' => $event->takeerReference,
                'received_at' => now(),
                'source_ip' => $request->ip(),
                'raw_body_encrypted' => $raw,
                'raw_body_sha256' => $hash,
                'filtered_headers' => $this->filteredHeaders($request),
                'signature_present' => $signaturePresent,
                'signature_valid' => $signatureValid,
                'amount_minor' => $event->amount !== null ? $this->minor($event->amount) : null,
                'currency' => $event->currency ? strtoupper($event->currency) : null,
                'validation_state' => $signatureValid ? 'verified' : 'rejected',
                'validation_errors' => $signatureValid ? null : ['signature' => 'Provider callback authentication failed.'],
            ],
        );
    }

    public function mark(ProviderEvent $event, string $state, ?string $result = null, ?array $errors = null): void
    {
        $event->update([
            'validation_state' => $state,
            'processing_result' => $result,
            'validation_errors' => $errors,
            'processed_at' => $state === 'processed' ? now() : $event->processed_at,
        ]);
    }

    public function minor(float|int|string $amount): int
    {
        return (int) round((float) $amount * 100);
    }

    private function providerEventId(PaymentEvent $event): ?string
    {
        $payload = $event->rawPayload ?: [];
        $value = data_get($payload, 'event_id')
            ?? data_get($payload, 'eventId')
            ?? data_get($payload, 'messageId')
            ?? data_get($payload, 'id');

        return $value !== null && (string) $value !== '' ? (string) $value : null;
    }

    private function filteredHeaders(Request $request): array
    {
        return collect($request->headers->all())
            ->only(['content-type', 'user-agent', 'x-selcom-signature', 'x-selcom-timestamp', 'verif-hash', 'digest'])
            ->mapWithKeys(function (array $values, string $key): array {
                $sensitive = in_array(strtolower($key), ['x-selcom-signature', 'verif-hash', 'digest'], true);
                return [$key => $sensitive ? ['[redacted]'] : $values];
            })
            ->all();
    }
}
