<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Forwarder;
use App\Models\ForwarderRoute;
use App\Models\ForwarderShipment;
use App\Models\Merchant;
use App\Models\UserAddress;
use App\Services\ForwarderShipmentService;
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
        $shipments = ForwarderShipment::query()
            ->where('user_id', $request->user()->id)
            ->with($this->relations())
            ->latest()
            ->get();

        return response()->json([
            'shipments' => $shipments->map(fn (ForwarderShipment $shipment) => $this->shipmentPayload($shipment))->values(),
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

        app(ForwarderShipmentService::class)->backfillForForwarder($forwarder);

        $perPage = min(max((int) $request->input('per_page', 12), 1), 50);
        $search = trim((string) $request->input('q', ''));

        $query = ForwarderShipment::query()
            ->where('forwarder_id', $forwarder->id)
            ->with($this->relations())
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
                $query->where(function ($query) use ($like): void {
                    $query->where('public_id', 'like', $like)
                        ->orWhere('tracking_number', 'like', $like)
                        ->orWhere('external_order_ref', 'like', $like)
                        ->orWhere('package_description', 'like', $like)
                        ->orWhere('seller_name', 'like', $like)
                        ->orWhere('seller_platform', 'like', $like)
                        ->orWhereHas('user', fn ($userQuery) => $userQuery->where('name', 'like', $like))
                        ->orWhereHas('order.product', fn ($productQuery) => $productQuery->where('title', 'like', $like));
                });
            });

        $statusCounts = (clone $query)
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $paginated = $query
            ->latest('last_status_at')
            ->paginate($perPage);

        return response()->json([
            'shipments' => collect($paginated->items())->map(fn (ForwarderShipment $shipment) => $this->shipmentPayload($shipment))->values(),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'status_counts' => $statusCounts,
            ],
        ]);
    }

    public function updateStatus(Request $request, Merchant $merchant, int|string $shipmentId): JsonResponse
    {
        abort_unless($request->user()?->merchantProfiles()->whereKey($merchant->id)->exists(), 403);
        $forwarder = $this->verifiedForwarder($merchant);
        abort_unless($forwarder, 403, 'Forwarder tools are available after admin approval.');

        $shipment = ForwarderShipment::query()
            ->where('forwarder_id', $forwarder->id)
            ->findOrFail($shipmentId);

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
            'tracking_url' => 'nullable|url|max:1000',
            'carrier_name' => 'nullable|string|max:255',
            'transport_reference' => 'nullable|string|max:255',
            'eta_text' => 'nullable|string|max:255',
            'attachments' => 'nullable|array',
            'metadata' => 'nullable|array',
        ]);

        $locationId = $this->validatedForwarderLocationId($forwarder, $validated['forwarder_location_id'] ?? null);
        $eventMetadata = array_filter([
            'tracking_number' => $validated['tracking_number'] ?? $shipment->tracking_number,
            'tracking_url' => $validated['tracking_url'] ?? null,
            'carrier_name' => $validated['carrier_name'] ?? null,
            'transport_reference' => $validated['transport_reference'] ?? null,
            'eta_text' => $validated['eta_text'] ?? null,
        ], fn ($value) => filled($value));

        $eventMetadata = array_merge($validated['metadata'] ?? [], $eventMetadata);
        $latestFreightUpdate = array_filter([
            'tracking_number' => $validated['tracking_number'] ?? $shipment->tracking_number,
            'tracking_url' => $validated['tracking_url'] ?? null,
            'carrier_name' => $validated['carrier_name'] ?? null,
            'transport_reference' => $validated['transport_reference'] ?? null,
            'eta_text' => $validated['eta_text'] ?? null,
        ], fn ($value) => filled($value));

        $shipment->update([
            'status' => $validated['status'],
            'tracking_number' => $validated['tracking_number'] ?? $shipment->tracking_number,
            'metadata' => array_replace($shipment->metadata ?: [], $latestFreightUpdate ? ['freight_tracking' => $latestFreightUpdate] : []),
            'last_status_at' => now(),
        ]);

        $shipment->events()->create([
            'actor_user_id' => $request->user()->id,
            'forwarder_location_id' => $locationId,
            'status' => $validated['status'],
            'note' => $validated['note'] ?? null,
            'attachments' => $validated['attachments'] ?? null,
            'metadata' => $eventMetadata ?: null,
        ]);

        $this->syncTakeerOrderFromShipment($shipment->fresh(['order.delivery', 'events']));

        return response()->json([
            'message' => 'Shipment status updated.',
            'shipment' => $this->shipmentPayload($shipment->fresh($this->relations())),
        ]);
    }

    private function syncTakeerOrderFromShipment(ForwarderShipment $shipment): void
    {
        if ($shipment->source_type !== 'takeer_order' || !$shipment->order?->delivery) {
            return;
        }

        $nextDeliveryStatus = match ($shipment->status) {
            ForwarderShipment::STATUS_INCOMING => null,
            'received_at_origin' => 'ready_at_terminal',
            'on_hold' => 'issue_reported',
            default => null,
        };

        if (!$nextDeliveryStatus) {
            return;
        }

        if (
            $nextDeliveryStatus === 'ready_at_terminal'
            && $shipment->order->payment_status === 'awaiting_merchant_confirmation'
        ) {
            $shipment->order->forceFill([
                'payment_status' => 'escrow_locked',
                'merchant_confirmed_at' => $shipment->order->merchant_confirmed_at ?: now(),
            ])->save();
        }

        if ($shipment->order->delivery->delivery_status === $nextDeliveryStatus) {
            return;
        }

        $shipment->order->delivery->update(['delivery_status' => $nextDeliveryStatus]);
        $shipment->order->delivery->events()->create([
            'order_id' => $shipment->order_id,
            'status' => $nextDeliveryStatus,
            'actor_type' => 'forwarder',
            'actor_user_id' => request()->user()?->id,
            'note' => 'Forwarder shipment status synced from freight inbox.',
            'metadata' => [
                'forwarder_shipment_id' => $shipment->id,
                'forwarder_status' => $shipment->status,
            ],
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
            'order.product',
            'order.merchant',
            'order.delivery.events',
        ];
    }

    private function shipmentPayload(ForwarderShipment $shipment): array
    {
        $order = $shipment->order;
        $address = $shipment->address_snapshot ?: $shipment->userAddress?->toArray();
        $defaultAddress = UserAddress::query()
            ->with(['country', 'state', 'cityRecord'])
            ->where('user_id', $shipment->user_id)
            ->where('type', '!=', 'forwarder')
            ->orderByDesc('is_default')
            ->latest()
            ->first();

        return [
            ...$shipment->toArray(),
            'customer_contact' => [
                'name' => $shipment->user?->name,
                'phone' => $shipment->user?->phone_number,
                'email' => $shipment->user?->email,
                'default_delivery_address' => $defaultAddress?->address_line,
                'default_delivery_place' => $this->addressPlaceLabel($defaultAddress),
                'default_delivery_map_url' => $this->mapUrl($defaultAddress?->address_line, $defaultAddress?->latitude, $defaultAddress?->longitude),
            ],
            'selected_address' => [
                'name' => $address['name'] ?? $shipment->originLocation?->name,
                'address_line' => $address['address_line'] ?? $shipment->originLocation?->address_line,
                'place' => $this->locationPlaceLabel($shipment->originLocation),
                'map_url' => $this->mapUrl(
                    $address['address_line'] ?? $shipment->originLocation?->address_line,
                    $shipment->originLocation?->latitude,
                    $shipment->originLocation?->longitude,
                ),
                'location' => $this->locationPayload($shipment->originLocation),
            ],
            'destination_address' => $this->locationPayload($shipment->destinationLocation),
            'package_items' => $this->packageItems($order, $shipment),
            'order_summary' => $order ? [
                'id' => $order->id,
                'public_id' => $order->public_id,
                'quantity' => $order->quantity,
                'total_paid' => $order->total_paid,
                'shipping_fee' => $order->shipping_fee,
                'payment_status' => $order->payment_status,
                'delivery_status' => $order->delivery?->delivery_status,
                'chat_url' => $order->public_id ? "/chat/{$order->public_id}?acting_as=merchant" : null,
            ] : null,
        ];
    }

    private function locationPayload(?\App\Models\ForwarderLocation $location): ?array
    {
        if (!$location) {
            return null;
        }

        return [
            'id' => $location->id,
            'name' => $location->name,
            'address_line' => $location->address_line,
            'contact_phone' => $location->contact_phone,
            'business_hours' => $location->business_hours,
            'place' => $this->locationPlaceLabel($location),
            'map_url' => $this->mapUrl($location->address_line, $location->latitude, $location->longitude),
            'country' => $location->country?->only(['id', 'name']),
            'state' => $location->state?->only(['id', 'name']),
            'city' => $location->cityRecord?->only(['id', 'name']),
        ];
    }

    private function locationPlaceLabel(?\App\Models\ForwarderLocation $location): ?string
    {
        if (!$location) {
            return null;
        }

        return collect([
            $location->cityRecord?->name,
            $location->state?->name,
            $location->country?->name,
        ])->filter()->implode(', ') ?: null;
    }

    private function addressPlaceLabel(?UserAddress $address): ?string
    {
        if (!$address) {
            return null;
        }

        return collect([
            $address->cityRecord?->name,
            $address->state?->name,
            $address->country?->name,
        ])->filter()->implode(', ') ?: null;
    }

    private function mapUrl(?string $address, mixed $latitude = null, mixed $longitude = null): ?string
    {
        if ($latitude && $longitude) {
            return 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode("{$latitude},{$longitude}");
        }

        if (!$address) {
            return null;
        }

        return 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($address);
    }

    private function packageItems(?\App\Models\Order $order, ForwarderShipment $shipment): array
    {
        if (!$order) {
            return [[
                'title' => $shipment->package_description ?: 'External package',
                'quantity' => $shipment->package_count,
                'amount' => null,
            ]];
        }

        if (!empty($order->bundle_item_selection)) {
            return collect($order->bundle_item_selection)->map(fn ($item) => [
                'title' => $item['title'] ?? 'Bundle item',
                'quantity' => $item['quantity'] ?? 1,
                'amount' => $item['price'] ?? null,
            ])->values()->all();
        }

        if (!empty($order->offering_group_selection['lines'])) {
            return collect($order->offering_group_selection['lines'])->map(fn ($item) => [
                'title' => $item['title'] ?? 'Package item',
                'quantity' => $item['quantity'] ?? 1,
                'amount' => $item['price'] ?? null,
            ])->values()->all();
        }

        return [[
            'title' => $order->product?->title ?: $shipment->package_description ?: 'Takeer order',
            'quantity' => $order->quantity,
            'amount' => $order->unit_price,
        ]];
    }
}
