<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Forwarder;
use App\Models\ForwarderRoute;
use App\Models\ForwarderShipment;
use App\Models\Merchant;
use App\Models\UserAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ForwarderShipmentController extends Controller
{
    private const STATUSES = [
        'incoming',
        'received_at_origin',
        'in_transit',
        'arrived_country',
        'customs_handling',
        'ready_for_pickup',
        'completed',
        'on_hold',
    ];

    public function myShipments(Request $request): JsonResponse
    {
        return response()->json([
            'shipments' => ForwarderShipment::query()
                ->where('user_id', $request->user()->id)
                ->with($this->relations())
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_address_id' => 'required|exists:user_addresses,id',
            'forwarder_route_id' => 'nullable|exists:forwarder_routes,id',
            'transport_mode' => 'nullable|string|max:80',
            'origin_location_id' => 'nullable|exists:forwarder_locations,id',
            'destination_location_id' => 'nullable|exists:forwarder_locations,id',
            'seller_name' => 'nullable|string|max:255',
            'seller_platform' => 'nullable|string|max:255',
            'external_order_ref' => 'nullable|string|max:255',
            'tracking_number' => 'nullable|string|max:255',
            'package_description' => 'nullable|string|max:3000',
            'package_count' => 'nullable|integer|min:1|max:999',
            'weight_estimate' => 'nullable|string|max:80',
            'required_field_values' => 'nullable|array',
            'attachments' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

        $address = UserAddress::query()
            ->where('user_id', $request->user()->id)
            ->with(['forwarder', 'forwarderRoute', 'forwarderLocation', 'country', 'state', 'cityRecord'])
            ->findOrFail($validated['user_address_id']);

        abort_unless($address->type === 'forwarder' && $address->forwarder_id, 422, 'Choose an imported forwarder address first.');

        $route = ForwarderRoute::query()
            ->with([
                'forwarder',
                'originLocations.country',
                'originLocations.state',
                'originLocations.cityRecord',
                'destinationLocations.country',
                'destinationLocations.state',
                'destinationLocations.cityRecord',
                'transportModes',
            ])
            ->where('forwarder_id', $address->forwarder_id)
            ->find($validated['forwarder_route_id'] ?? $address->forwarder_route_id);

        if ($route && !$route->is_active) {
            return response()->json([
                'message' => 'This freight route is inactive and cannot be used for a new shipment request.',
            ], 422);
        }

        $shipment = ForwarderShipment::create([
            'user_id' => $request->user()->id,
            'forwarder_id' => $address->forwarder_id,
            'forwarder_route_id' => $route?->id,
            'transport_mode' => $validated['transport_mode'] ?? $address->forwarder_transport_mode,
            'origin_location_id' => $validated['origin_location_id'] ?? $address->forwarder_location_id,
            'destination_location_id' => $validated['destination_location_id'] ?? $route?->destinationLocations->first()?->id,
            'user_address_id' => $address->id,
            'source_type' => 'external_purchase',
            'status' => ForwarderShipment::STATUS_INCOMING,
            'seller_name' => $validated['seller_name'] ?? null,
            'seller_platform' => $validated['seller_platform'] ?? null,
            'external_order_ref' => $validated['external_order_ref'] ?? null,
            'tracking_number' => $validated['tracking_number'] ?? null,
            'package_description' => $validated['package_description'] ?? null,
            'package_count' => $validated['package_count'] ?? null,
            'weight_estimate' => $validated['weight_estimate'] ?? null,
            'required_field_values' => $validated['required_field_values'] ?? null,
            'attachments' => $validated['attachments'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
            'address_snapshot' => $address->toArray(),
            'route_snapshot' => $route ? $this->routeSnapshot($route) : null,
        ]);

        $shipment->events()->create([
            'actor_user_id' => $request->user()->id,
            'status' => ForwarderShipment::STATUS_INCOMING,
            'note' => 'Shipment request created from imported forwarder address.',
        ]);

        return response()->json([
            'message' => 'Shipment request created.',
            'shipment' => $shipment->load($this->relations()),
        ], 201);
    }

    public function merchantShipments(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($request->user()?->merchantProfiles()->whereKey($merchant->id)->exists(), 403);
        $forwarder = $this->verifiedForwarder($merchant);
        abort_unless($forwarder, 403, 'Forwarder tools are available after admin approval.');

        return response()->json([
            'shipments' => ForwarderShipment::query()
                ->where('forwarder_id', $forwarder->id)
                ->with($this->relations())
                ->latest('last_status_at')
                ->get(),
        ]);
    }

    public function updateStatus(Request $request, Merchant $merchant, ForwarderShipment $shipment): JsonResponse
    {
        abort_unless($request->user()?->merchantProfiles()->whereKey($merchant->id)->exists(), 403);
        $forwarder = $this->verifiedForwarder($merchant);
        abort_unless($forwarder && (int) $shipment->forwarder_id === (int) $forwarder->id, 404);

        return $this->applyShipmentUpdate($request, $shipment, $forwarder);
    }

    public function updateStatusByIdentifier(Request $request, Merchant $merchant, string $identifier): JsonResponse
    {
        abort_unless($request->user()?->merchantProfiles()->whereKey($merchant->id)->exists(), 403);
        $forwarder = $this->verifiedForwarder($merchant);
        abort_unless($forwarder, 403, 'Forwarder tools are available after admin approval.');

        $shipment = ForwarderShipment::query()
            ->where('forwarder_id', $forwarder->id)
            ->where(function ($query) use ($identifier): void {
                $query->where('public_id', $identifier)
                    ->orWhere('tracking_number', $identifier)
                    ->orWhere('external_order_ref', $identifier);
            })
            ->firstOrFail();

        return $this->applyShipmentUpdate($request, $shipment, $forwarder);
    }

    private function applyShipmentUpdate(Request $request, ForwarderShipment $shipment, Forwarder $forwarder): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'note' => 'nullable|string|max:3000',
            'forwarder_location_id' => 'nullable|exists:forwarder_locations,id',
            'tracking_number' => 'nullable|string|max:255',
            'attachments' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

        $locationId = $this->validatedForwarderLocationId($forwarder, $validated['forwarder_location_id'] ?? null);

        $shipment->update([
            'status' => $validated['status'],
            'tracking_number' => $validated['tracking_number'] ?? $shipment->tracking_number,
            'last_status_at' => now(),
        ]);

        $shipment->events()->create([
            'actor_user_id' => $request->user()->id,
            'forwarder_location_id' => $locationId,
            'status' => $validated['status'],
            'note' => $validated['note'] ?? null,
            'attachments' => $validated['attachments'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
        ]);

        return response()->json([
            'message' => 'Shipment status updated.',
            'shipment' => $shipment->fresh($this->relations()),
        ]);
    }

    private function validatedForwarderLocationId(Forwarder $forwarder, mixed $locationId): ?int
    {
        if (!$locationId) {
            return null;
        }

        $exists = $forwarder->locations()
            ->whereKey((int) $locationId)
            ->exists();

        abort_unless($exists, 422, 'Selected location does not belong to this forwarder.');

        return (int) $locationId;
    }

    private function routeSnapshot(ForwarderRoute $route): array
    {
        return [
            'id' => $route->id,
            'route_uid' => $route->route_uid,
            'label' => $route->label,
            'origin_country_id' => $route->origin_country_id,
            'destination_country_id' => $route->destination_country_id,
            'origin_locations' => $route->originLocations->values()->all(),
            'destination_locations' => $route->destinationLocations->values()->all(),
            'transport_modes' => $route->transportModes->values()->all(),
            'estimate' => $route->estimate,
            'rates_info' => $route->rates_info,
            'payment_terms' => $route->transportModes
                ->mapWithKeys(fn ($mode) => [$mode->mode => [
                    'payment_term' => $mode->payment_term,
                    'deposit_type' => $mode->deposit_type,
                    'deposit_value' => $mode->deposit_value,
                    'balance_due' => $mode->balance_due,
                    'payment_notes' => $mode->payment_notes,
                ]])
                ->all(),
        ];
    }

    private function verifiedForwarder(Merchant $merchant): ?Forwarder
    {
        return Forwarder::query()
            ->where('merchant_id', $merchant->id)
            ->where('is_verified', true)
            ->where('verification_status', 'verified')
            ->latest()
            ->first();
    }

    private function relations(): array
    {
        return [
            'forwarder',
            'route.originCountry',
            'route.destinationCountry',
            'originLocation.country',
            'originLocation.state',
            'originLocation.cityRecord',
            'destinationLocation.country',
            'destinationLocation.state',
            'destinationLocation.cityRecord',
            'events.location',
            'events.actor',
            'userAddress',
            'user',
        ];
    }
}
