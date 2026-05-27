<?php

namespace App\Services;

use App\Models\Forwarder;
use App\Models\ForwarderRoute;
use App\Models\ForwarderShipment;
use App\Models\Order;
use App\Models\UserAddress;

class ForwarderShipmentService
{
    public function createForTakeerOrder(Order $order, ?int $userAddressId): ?ForwarderShipment
    {
        if (!$userAddressId || !$order->buyer_id) {
            return null;
        }

        $address = UserAddress::query()
            ->whereKey($userAddressId)
            ->where('user_id', $order->buyer_id)
            ->with(['forwarder', 'forwarderRoute', 'forwarderLocation', 'country', 'state', 'cityRecord'])
            ->first();

        if (!$address || $address->type !== 'forwarder' || !$address->forwarder_id) {
            return null;
        }

        $route = null;
        if ($address->forwarder_route_id) {
            $route = ForwarderRoute::query()
                ->where('forwarder_id', $address->forwarder_id)
                ->with([
                    'originLocations.country',
                    'originLocations.state',
                    'originLocations.cityRecord',
                    'destinationLocations.country',
                    'destinationLocations.state',
                    'destinationLocations.cityRecord',
                    'transportModes',
                ])
                ->find($address->forwarder_route_id);
        }

        if ($route && !$route->is_active) {
            return null;
        }

        $order->loadMissing(['merchant', 'product']);

        $shipment = ForwarderShipment::query()->firstOrCreate(
            ['order_id' => $order->id, 'source_type' => 'takeer_order'],
            [
                'user_id' => $order->buyer_id,
                'forwarder_id' => $address->forwarder_id,
                'forwarder_route_id' => $route?->id,
                'transport_mode' => $address->forwarder_transport_mode,
                'origin_location_id' => $address->forwarder_location_id,
                'destination_location_id' => $route?->destinationLocations->first()?->id,
                'user_address_id' => $address->id,
                'status' => ForwarderShipment::STATUS_INCOMING,
                'seller_name' => $order->merchant?->display_name,
                'seller_platform' => 'Takeer',
                'external_order_ref' => $order->public_id ?: (string) $order->id,
                'package_description' => $this->packageDescription($order),
                'package_count' => max(1, (int) ceil((float) ($order->requested_quantity ?: $order->quantity ?: 1))),
                'address_snapshot' => $address->toArray(),
                'route_snapshot' => $route ? [
                    'id' => $route->id,
                    'route_uid' => $route->route_uid,
                    'origin_country_id' => $route->origin_country_id,
                    'destination_country_id' => $route->destination_country_id,
                    'origin_locations' => $route->originLocations->values()->all(),
                    'destination_locations' => $route->destinationLocations->values()->all(),
                    'transport_modes' => $route->transportModes->values()->all(),
                    'estimate' => $route->estimate,
                    'rates_info' => $route->rates_info,
                ] : null,
                'metadata' => [
                    'takeer_protection' => true,
                    'payment_status' => $order->payment_status,
                    'transport_mode' => $address->forwarder_transport_mode,
                ],
            ],
        );

        if ($shipment->wasRecentlyCreated) {
            $shipment->events()->create([
                'actor_user_id' => $order->buyer_id,
                'status' => ForwarderShipment::STATUS_INCOMING,
                'note' => 'Takeer order paid/confirmed using an imported forwarder address.',
                'metadata' => [
                    'order_id' => $order->id,
                    'source' => 'takeer_checkout',
                ],
            ]);
        }

        return $shipment;
    }

    public function backfillForForwarder(Forwarder $forwarder, int $limit = 100): int
    {
        $addressIds = UserAddress::query()
            ->where('forwarder_id', $forwarder->id)
            ->pluck('id');

        if ($addressIds->isEmpty()) {
            return 0;
        }

        $created = 0;

        Order::query()
            ->with(['delivery', 'merchant', 'product'])
            ->whereIn('user_address_id', $addressIds)
            ->whereIn('payment_status', ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'resolved_merchant_paid'])
            ->whereHas('delivery', fn ($query) => $query->where('delivery_type', 'forwarder'))
            ->latest()
            ->limit($limit)
            ->get()
            ->each(function (Order $order) use (&$created): void {
                $shipment = $this->createForTakeerOrder($order, $order->user_address_id);
                if ($shipment?->wasRecentlyCreated) {
                    $created++;
                }
            });

        return $created;
    }

    public function syncFromOrderDelivery(Order $order, ?int $actorUserId = null): ?ForwarderShipment
    {
        $order->loadMissing(['delivery']);

        if ($order->delivery?->delivery_type !== 'forwarder') {
            return null;
        }

        if (
            in_array($order->delivery->delivery_status, ['with_boda', 'ready_at_terminal', 'customer_confirmed'], true)
            && $order->payment_status === 'awaiting_merchant_confirmation'
        ) {
            $order->forceFill([
                'payment_status' => 'escrow_locked',
                'merchant_confirmed_at' => $order->merchant_confirmed_at ?: now(),
            ])->save();
        }

        $shipment = $this->createForTakeerOrder($order, $order->user_address_id);
        if (!$shipment) {
            return null;
        }

        $nextStatus = match ($order->delivery->delivery_status) {
            'with_boda' => ForwarderShipment::STATUS_INCOMING,
            'ready_at_terminal' => 'received_at_origin',
            'issue_reported', 'disputed' => 'on_hold',
            default => null,
        };

        if ($order->delivery->delivery_status === 'customer_confirmed') {
            if ($shipment->status === 'received_at_origin') {
                $alreadyLogged = $shipment->events()
                    ->where('status', 'received_at_origin')
                    ->where('metadata->buyer_confirmed_handoff', true)
                    ->exists();

                if (! $alreadyLogged) {
                    $shipment->events()->create([
                        'actor_user_id' => $actorUserId,
                        'status' => 'received_at_origin',
                        'note' => 'Buyer confirmed forwarder handoff. Seller-side SafePay was released; freight tracking remains active.',
                        'metadata' => [
                            'order_id' => $order->id,
                            'delivery_status' => $order->delivery->delivery_status,
                            'buyer_confirmed_handoff' => true,
                        ],
                    ]);
                }
            }

            return $shipment->fresh();
        }

        if (!$nextStatus || $shipment->status === $nextStatus) {
            return $shipment;
        }

        $rank = [
            ForwarderShipment::STATUS_INCOMING => 0,
            'received_at_origin' => 1,
            'in_transit' => 2,
            'arrived_country' => 3,
            'customs_handling' => 4,
            'ready_for_pickup' => 5,
            'completed' => 6,
            'on_hold' => 7,
        ];

        if (($rank[$nextStatus] ?? 0) < ($rank[$shipment->status] ?? 0) && $nextStatus !== 'on_hold') {
            return $shipment;
        }

        $shipment->update([
            'status' => $nextStatus,
            'last_status_at' => now(),
        ]);

        $shipment->events()->create([
            'actor_user_id' => $actorUserId,
            'status' => $nextStatus,
            'note' => 'Synced from Takeer order delivery status.',
            'metadata' => [
                'order_id' => $order->id,
                'delivery_status' => $order->delivery->delivery_status,
            ],
        ]);

        return $shipment->fresh();
    }

    private function packageDescription(Order $order): string
    {
        if ($order->product?->title) {
            return $order->product->title;
        }

        if (!empty($order->bundle_item_selection)) {
            return collect($order->bundle_item_selection)
                ->pluck('title')
                ->filter()
                ->join(', ') ?: 'Takeer bundle order';
        }

        if (!empty($order->offering_group_selection['lines'])) {
            return collect($order->offering_group_selection['lines'])
                ->pluck('title')
                ->filter()
                ->join(', ') ?: 'Takeer order';
        }

        return 'Takeer order';
    }
}
