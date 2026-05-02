<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\MerchantServiceIntegration;
use App\Models\ServiceRequest;

class ServiceCalendarIntegrationService
{
    public function ensureGoogleCalendarPending(Merchant $merchant): MerchantServiceIntegration
    {
        return MerchantServiceIntegration::firstOrCreate(
            [
                'merchant_id' => $merchant->id,
                'provider' => 'google_calendar',
            ],
            [
                'status' => 'pending',
                'calendar_id' => 'primary',
                'scopes' => [
                    'https://www.googleapis.com/auth/calendar.events',
                    'https://www.googleapis.com/auth/calendar.readonly',
                ],
                'settings' => [
                    'sync_confirmed_requests' => true,
                    'create_event_on_confirm' => true,
                ],
            ]
        );
    }

    public function prepareEvent(ServiceRequest $serviceRequest): ServiceRequest
    {
        $serviceRequest->loadMissing(['merchant', 'product']);
        $integration = $this->ensureGoogleCalendarPending($serviceRequest->merchant);

        if (!$serviceRequest->scheduled_at) {
            throw new \RuntimeException('Schedule the service request before preparing a calendar event.');
        }

        $duration = max(15, (int) ($serviceRequest->duration_minutes ?: $serviceRequest->product?->service_duration_minutes ?: 60));
        $endsAt = $serviceRequest->scheduled_ends_at ?: $serviceRequest->scheduled_at->copy()->addMinutes($duration);

        $serviceRequest->update([
            'scheduled_ends_at' => $endsAt,
            'timezone' => $serviceRequest->timezone ?: 'Africa/Dar_es_Salaam',
            'calendar_provider' => 'google_calendar',
            'calendar_sync_status' => $integration->status === 'connected' ? 'ready_to_sync' : 'pending_integration',
            'calendar_sync_error' => $integration->status === 'connected' ? null : 'Google Calendar OAuth is not connected yet.',
            'metadata' => array_merge($serviceRequest->metadata ?? [], [
                'calendar_event_payload' => $this->eventPayload($serviceRequest, $endsAt),
            ]),
        ]);

        return $serviceRequest->refresh();
    }

    public function eventPayload(ServiceRequest $serviceRequest, mixed $endsAt = null): array
    {
        $serviceRequest->loadMissing(['merchant', 'product']);
        $endsAt = $endsAt ?: $serviceRequest->scheduled_ends_at;

        return [
            'summary' => trim(($serviceRequest->product?->title ?: 'Service appointment').' - '.$serviceRequest->customer_name),
            'description' => trim(implode("\n", array_filter([
                $serviceRequest->message,
                $serviceRequest->customer_phone ? 'Phone: '.$serviceRequest->customer_phone : null,
                $serviceRequest->customer_email ? 'Email: '.$serviceRequest->customer_email : null,
                $serviceRequest->location_text ? 'Location: '.$serviceRequest->location_text : null,
            ]))),
            'start' => [
                'dateTime' => $serviceRequest->scheduled_at?->toIso8601String(),
                'timeZone' => $serviceRequest->timezone ?: 'Africa/Dar_es_Salaam',
            ],
            'end' => [
                'dateTime' => $endsAt?->toIso8601String(),
                'timeZone' => $serviceRequest->timezone ?: 'Africa/Dar_es_Salaam',
            ],
            'attendees' => array_values(array_filter([
                $serviceRequest->customer_email ? ['email' => $serviceRequest->customer_email, 'displayName' => $serviceRequest->customer_name] : null,
            ])),
            'extendedProperties' => [
                'private' => [
                    'takeer_service_request_id' => (string) $serviceRequest->id,
                    'takeer_public_id' => (string) $serviceRequest->public_id,
                ],
            ],
        ];
    }
}
