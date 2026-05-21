<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\MessageSent;
use App\Models\Delivery;
use App\Models\Message;
use App\Models\RiderWaitlistEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class RiderDeliveryController extends Controller
{
    private const RIDER_STATUSES = [
        'with_boda',
        'in_transit',
        'arrived',
        'ready_at_terminal',
        'issue_reported',
    ];

    public function show(string $token): Response
    {
        $delivery = $this->deliveryForToken($token)
            ->load(['order.merchant.locations', 'order.product', 'events']);
        $this->ensureReleasePin($delivery);

        return Inertia::render('RiderDelivery', [
            'token' => $token,
            'delivery' => $this->payload($delivery),
        ]);
    }

    public function update(Request $request, string $token): JsonResponse
    {
        $delivery = $this->deliveryForToken($token)->load(['order.merchant']);
        $this->ensureReleasePin($delivery);
        abort_if($delivery->delivery_status === 'delivered', 410, 'Mzigo umeshakamilika.');

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', self::RIDER_STATUSES)],
            'note' => [$request->input('status') === 'issue_reported' ? 'required' : 'nullable', 'string', 'max:1000'],
            'proof' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska', 'max:51200'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);
        if ($validated['status'] !== 'issue_reported') {
            $currentIndex = $this->deliveryStepIndex($delivery->delivery_status, $delivery->delivery_type);
            $nextIndex = $this->deliveryStepIndex($validated['status'], $delivery->delivery_type);
            abort_if($nextIndex < $currentIndex || $nextIndex > $currentIndex + 1, 422, 'Hatua lazima zifuatane kwa mpangilio.');
        }

        $proofUrl = null;
        $proofMime = null;
        $proofType = null;
        if ($request->hasFile('proof')) {
            $file = $request->file('proof');
            $path = $file->store('rider-delivery-proofs', 'public');
            $proofUrl = Storage::disk('public')->url($path);
            $proofMime = $file->getClientMimeType();
            $proofType = str_starts_with((string) $proofMime, 'image/') ? 'photo' : 'video';
        }

        if ($validated['status'] !== 'issue_reported') {
            $delivery->fill([
                'delivery_status' => $validated['status'],
            ])->save();
        }

        $eventMetadata = array_filter([
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
            'stage_status' => $validated['status'] === 'issue_reported'
                ? $this->currentStageStatus($delivery)
                : null,
        ]);

        $delivery->events()->create([
            'order_id' => $delivery->order_id,
            'status' => $validated['status'],
            'actor_type' => 'rider',
            'actor_user_id' => null,
            'proof_url' => $proofUrl,
            'proof_mime' => $proofMime,
            'proof_type' => $proofType,
            'note' => $validated['note'] ?? null,
            'metadata' => $eventMetadata,
        ]);
        $this->appendChatDeliveryUpdate($delivery->fresh(['order.merchant.user']), $validated['status'], $validated['note'] ?? null, $proofUrl, [
            'latitude' => $validated['latitude'] ?? null,
            'longitude' => $validated['longitude'] ?? null,
            'stage_status' => $validated['status'] === 'issue_reported'
                ? $this->currentStageStatus($delivery)
                : null,
        ]);

        return response()->json([
            'message' => 'Status imehifadhiwa.',
            'delivery' => $this->payload($delivery->fresh(['order.merchant.locations', 'order.product', 'events'])),
        ]);
    }

    public function confirmPin(Request $request, string $token): JsonResponse
    {
        $delivery = $this->deliveryForToken($token)->load(['order.product']);
        $this->ensureReleasePin($delivery);
        abort_if($delivery->delivery_status === 'delivered', 410, 'Mzigo umeshakamilika.');
        abort_if($delivery->delivery_type === 'intercity_bus', 422, 'Mzigo wa mkoa hukamilishwa kwenye hatua ya terminal.');
        abort_if(
            $this->deliveryStepIndex($delivery->delivery_status, $delivery->delivery_type) < $this->deliveryStepIndex('arrived', $delivery->delivery_type),
            422,
            'Bonyeza umefika kwa mteja kabla ya kukamilisha mzigo.'
        );

        $validated = $request->validate([
            'pin' => ['required', 'string', 'size:4'],
            'note' => ['nullable', 'string', 'max:1000'],
            'proof' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska', 'max:51200'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $validPins = collect([$delivery->buyer_release_pin, $delivery->pickup_pin])
            ->filter()
            ->map(fn ($pin) => (string) $pin)
            ->values();

        if ($validPins->isEmpty() || ! $validPins->contains((string) $validated['pin'])) {
            return response()->json(['message' => 'PIN si sahihi.'], 400);
        }

        $proofUrl = null;
        $proofMime = null;
        $proofType = null;
        if ($request->hasFile('proof')) {
            $file = $request->file('proof');
            $path = $file->store('rider-delivery-proofs', 'public');
            $proofUrl = Storage::disk('public')->url($path);
            $proofMime = $file->getClientMimeType();
            $proofType = str_starts_with((string) $proofMime, 'image/') ? 'photo' : 'video';
        }

        DB::transaction(function () use ($delivery, $validated, $proofUrl, $proofMime, $proofType) {
            $order = $delivery->order;

            $delivery->update(['delivery_status' => 'delivered']);
            $delivery->events()->create([
                'order_id' => $delivery->order_id,
                'status' => 'delivered',
                'actor_type' => 'rider',
                'actor_user_id' => null,
                'proof_url' => $proofUrl,
                'proof_mime' => $proofMime,
                'proof_type' => $proofType,
                'note' => $validated['note'] ?? 'Buyer release PIN verified by rider link.',
                'metadata' => array_filter([
                    'latitude' => $validated['latitude'] ?? null,
                    'longitude' => $validated['longitude'] ?? null,
                ]),
            ]);
            $this->appendChatDeliveryUpdate($delivery->fresh(['order.merchant.user']), 'delivered', $validated['note'] ?? 'Buyer release PIN verified by rider link.', $proofUrl, [
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
            ]);

            app(\App\Services\WalletService::class)->releaseEscrowToMerchant($order);
            app(\App\Services\EntitlementService::class)->grantForOrder($order->fresh(['product']));
        });

        return response()->json([
            'message' => 'Mzigo umethibitishwa. Malipo yameidhinishwa.',
            'delivery' => $this->payload($delivery->fresh(['order.merchant.locations', 'order.product', 'events'])),
        ]);
    }

    public function joinWaitlist(Request $request, string $token): JsonResponse
    {
        $delivery = $this->deliveryForToken($token)->load(['order.merchant']);
        abort_if($delivery->delivery_status !== 'delivered', 422, 'Orodha ya kusubiri inaonekana baada ya mzigo kukamilika.');

        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:40'],
            'city' => ['nullable', 'string', 'max:120'],
            'main_station' => ['nullable', 'string', 'max:160'],
            'vehicle_type' => ['nullable', 'string', 'in:boda,bajaj,car,van,walking,other'],
        ]);

        $normalizedPhone = $this->normalizePhone($validated['phone']);
        abort_if($normalizedPhone === '', 422, 'Namba ya simu inahitajika.');

        RiderWaitlistEntry::updateOrCreate(
            ['phone_normalized' => $normalizedPhone],
            [
                'name' => $validated['name'] ?: $delivery->delivery_person_name,
                'phone' => $validated['phone'],
                'city' => $validated['city'] ?? null,
                'main_station' => $validated['main_station'] ?? null,
                'vehicle_type' => $validated['vehicle_type'] ?? null,
                'source_delivery_id' => $delivery->id,
                'source_order_id' => $delivery->order_id,
                'status' => 'pending',
                'metadata' => [
                    'source' => 'completed_rider_delivery_link',
                    'merchant_name' => $delivery->order?->merchant?->display_name,
                    'joined_from_delivery_type' => $delivery->delivery_type,
                ],
            ]
        );

        return response()->json([
            'message' => 'Umeongezwa kwenye orodha ya kusubiri.',
            'delivery' => $this->payload($delivery->fresh(['order.merchant.locations', 'order.product', 'events'])),
        ]);
    }

    private function deliveryForToken(string $token): Delivery
    {
        $delivery = Delivery::query()
            ->where('rider_access_token_hash', hash('sha256', $token))
            ->whereNull('rider_access_revoked_at')
            ->where(function ($query) {
                $query->whereNull('rider_access_expires_at')
                    ->orWhere('rider_access_expires_at', '>', now());
            })
            ->firstOrFail();

        return $delivery;
    }

    private function payload(Delivery $delivery): array
    {
        $order = $delivery->order;
        $origin = $this->nearestOrigin($delivery);
        $routeUrl = null;
        if ($origin && $delivery->latitude && $delivery->longitude) {
            $routeUrl = 'https://www.google.com/maps/dir/?api=1'
                . '&origin=' . $origin['latitude'] . ',' . $origin['longitude']
                . '&destination=' . $delivery->latitude . ',' . $delivery->longitude
                . '&travelmode=driving';
        }

        return [
            'id' => $delivery->id,
            'order_public_id' => $order?->public_id,
            'order_id' => $order?->id,
            'title' => $order?->product?->title
                ?: data_get($order?->offering_group_selection, 'group.title')
                ?: 'Oda ya usafirishaji',
            'merchant_name' => $order?->merchant?->display_name,
            'status' => $delivery->delivery_status,
            'delivery_type' => $delivery->delivery_type,
            'physical_address' => $delivery->physical_address,
            'latitude' => $delivery->latitude !== null ? (float) $delivery->latitude : null,
            'longitude' => $delivery->longitude !== null ? (float) $delivery->longitude : null,
            'boda_phone' => $delivery->boda_phone,
            'delivery_person_name' => $delivery->delivery_person_name,
            'bus_company' => $delivery->bus_company,
            'waybill_tracking_number' => $delivery->waybill_tracking_number,
            'route_url' => $routeUrl,
            'route_text' => $routeUrl ? sprintf(
                'Delivery route: %s to %s %s',
                $origin['name'] ?: 'Shop',
                $delivery->physical_address ?: 'customer location',
                $routeUrl
            ) : null,
            'rider_waitlist_joined' => $this->riderWaitlistJoined($delivery),
            'expires_at' => $delivery->rider_access_expires_at?->toISOString(),
            'events' => $delivery->events->sortBy('created_at')->map(fn ($event) => [
                'id' => $event->id,
                'status' => $event->status,
                'note' => $event->note,
                'proof_url' => $event->proof_url,
                'proof_type' => $event->proof_type,
                'metadata' => $event->metadata,
                'created_at' => $event->created_at?->toISOString(),
            ])->values(),
        ];
    }

    private function ensureReleasePin(Delivery $delivery): void
    {
        if ($delivery->delivery_type === 'self_pickup') {
            if (! $delivery->pickup_pin) {
                $delivery->forceFill([
                    'pickup_pin' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
                ])->save();
            }

            return;
        }

        if (! $delivery->buyer_release_pin) {
            $delivery->forceFill([
                'buyer_release_pin' => str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
            ])->save();
        }
    }

    private function riderWaitlistJoined(Delivery $delivery): bool
    {
        $normalizedPhone = $this->normalizePhone($delivery->boda_phone);
        if ($normalizedPhone === '') {
            return false;
        }

        return RiderWaitlistEntry::query()
            ->where('phone_normalized', $normalizedPhone)
            ->exists();
    }

    private function normalizePhone(?string $phone): string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';
        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            return '255' . substr($digits, 1);
        }
        if (strlen($digits) === 9 && preg_match('/^[67]/', $digits)) {
            return '255' . $digits;
        }

        return $digits;
    }

    private function nearestOrigin(Delivery $delivery): ?array
    {
        $locations = $delivery->order?->merchant?->locations ?? collect();
        if ($locations->isEmpty()) {
            return null;
        }

        $lat = $delivery->latitude !== null ? (float) $delivery->latitude : null;
        $lng = $delivery->longitude !== null ? (float) $delivery->longitude : null;

        $location = $locations
            ->filter(fn ($location) => $location->latitude !== null && $location->longitude !== null)
            ->sortBy(function ($location) use ($lat, $lng) {
                if ($lat === null || $lng === null) {
                    return $location->is_primary ? 0 : 1;
                }

                return abs((float) $location->latitude - $lat) + abs((float) $location->longitude - $lng);
            })
            ->first();

        if (! $location) {
            return null;
        }

        return [
            'name' => $location->name,
            'latitude' => (float) $location->latitude,
            'longitude' => (float) $location->longitude,
        ];
    }

    private function deliveryStepIndex(?string $status, ?string $type): int
    {
        $steps = $type === 'intercity_bus'
            ? ['with_boda', 'in_transit', 'ready_at_terminal', 'delivered']
            : ['with_boda', 'in_transit', 'arrived', 'delivered'];

        $index = array_search($status, $steps, true);

        return $index === false ? -1 : (int) $index;
    }

    private function currentStageStatus(Delivery $delivery): ?string
    {
        return $this->deliveryStepIndex($delivery->delivery_status, $delivery->delivery_type) >= 0
            ? $delivery->delivery_status
            : null;
    }

    private function appendChatDeliveryUpdate(Delivery $delivery, string $status, ?string $note = null, ?string $proofUrl = null, array $metadata = []): void
    {
        $order = $delivery->order;
        $senderId = $order?->merchant?->user_id;
        $receiverId = $order?->buyer_id;
        if (! $order || ! $senderId || ! $receiverId) {
            return;
        }

        $message = Message::create([
            'order_id' => $order->id,
            'sender_id' => $senderId,
            'receiver_id' => $receiverId,
            'type' => 'action',
            'body' => 'Delivery status updated: ' . str_replace('_', ' ', $status),
            'media_url' => $proofUrl,
            'payload' => [
                'action_type' => 'delivery_status_update',
                'status' => $status,
                'note' => $note,
                'proof_url' => $proofUrl,
                'actor_type' => 'rider',
                'boda_phone' => $delivery->boda_phone,
                'delivery_person_name' => $delivery->delivery_person_name,
                'route_url' => $this->payload($delivery)['route_url'] ?? null,
                'metadata' => array_filter($metadata),
            ],
        ]);

        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();
    }
}
