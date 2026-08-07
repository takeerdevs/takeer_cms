<?php

namespace App\Services;

use App\Models\SocialCommerceRequest;
use App\Models\SocialCommerceRequestEvent;
use App\Models\MarketingEvent;
use Illuminate\Http\Request;

class SocialCommerceAuditService
{
    public function record(
        SocialCommerceRequest $request,
        string $eventType,
        ?string $fromStatus = null,
        ?string $toStatus = null,
        ?Request $httpRequest = null,
        ?int $actorId = null,
        ?string $actorType = null,
        ?string $channel = null,
        array $metadata = [],
    ): SocialCommerceRequestEvent {
        $ip = $httpRequest?->ip();
        $agent = $httpRequest?->userAgent();

        $event = $request->events()->create([
            'actor_type' => $actorType ?: ($actorId ? 'user' : null),
            'actor_id' => $actorId,
            'event_type' => $eventType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'channel' => $channel,
            'ip_hash' => $ip ? hash_hmac('sha256', $ip, (string) config('app.key')) : null,
            'user_agent_summary' => $agent ? mb_substr($agent, 0, 255) : null,
            'metadata' => $metadata,
            'occurred_at' => now(),
            'created_at' => now(),
        ]);
        try {
            MarketingEvent::create([
                'merchant_id' => $request->claimed_merchant_id,
                'user_id' => $request->buyer_id,
                'order_id' => $request->order_id,
                'session_id' => 'social-request:' . $request->id,
                'event_type' => $eventType,
                'entity_type' => 'social_commerce_request',
                'entity_id' => $request->id,
                'source' => 'social_commerce',
                'source_url' => $request->normalized_url,
                'metadata' => array_merge($metadata, ['request_public_id' => $request->public_id]),
            ]);
        } catch (\Throwable) {
            // Analytics must never roll back a request, claim, offer, or order.
        }
        return $event;
    }

    public function transition(
        SocialCommerceRequest $request,
        string $toStatus,
        string $eventType,
        ?Request $httpRequest = null,
        ?int $actorId = null,
        ?string $channel = null,
        array $metadata = [],
    ): SocialCommerceRequest {
        $locked = SocialCommerceRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
        $from = $locked->status;
        $locked->transitionTo($toStatus);
        $locked->increment('lock_version');
        $locked->save();
        $this->record($locked, $eventType, $from, $toStatus, $httpRequest, $actorId, null, $channel, $metadata);

        return $locked;
    }
}
