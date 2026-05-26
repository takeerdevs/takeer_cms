<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\GeographyResolver;
use App\Models\ForwarderRoute;
use App\Models\UserAddress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserAddressController extends Controller
{
    public function __construct(private GeographyResolver $geography)
    {
    }

    public function index()
    {
        return response()->json([
            'addresses' => Auth::user()->addresses()->with(['forwarder.country', 'forwarderRoute', 'forwarderLocation', 'country', 'state', 'cityRecord'])->get()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'type' => 'required|in:local,forwarder',
            'address_line' => 'required|string',
            'extra_details' => 'nullable|string',
            'country_id' => 'nullable|exists:countries,id',
            'country_iso2' => 'nullable|string|size:2',
            'country_name' => 'nullable|string|max:120',
            'state_id' => 'nullable|exists:country_states,id',
            'state_name' => 'nullable|string|max:120',
            'city_id' => 'nullable|exists:country_cities,id',
            'city_name' => 'nullable|string|max:120',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'is_default' => 'boolean',
            'forwarder_id' => 'nullable|exists:forwarders,id',
            'forwarder_route_id' => 'nullable|exists:forwarder_routes,id',
            'forwarder_route_uid' => 'nullable|string|max:120',
            'forwarder_location_id' => 'nullable|exists:forwarder_locations,id',
            'forwarder_transport_mode' => 'nullable|string|max:80',
            'forwarder_customer_id' => 'nullable|string|max:255',
        ]);

        if (!empty($validated['forwarder_route_uid']) && empty($validated['forwarder_route_id'])) {
            $route = ForwarderRoute::query()
                ->where('route_uid', $validated['forwarder_route_uid'])
                ->first();

            if ($route) {
                $validated['forwarder_route_id'] = $route->id;
                $validated['forwarder_id'] = $validated['forwarder_id'] ?? $route->forwarder_id;
            }
        }
        unset($validated['forwarder_route_uid']);

        if (($validated['type'] ?? null) === 'forwarder' && !empty($validated['forwarder_route_id'])) {
            $route = ForwarderRoute::query()->find($validated['forwarder_route_id']);
            if (!$route?->is_active) {
                return response()->json([
                    'message' => 'This freight route is no longer active. Please choose another active route.',
                ], 422);
            }
        }

        if ($validated['is_default'] ?? false) {
            Auth::user()->addresses()->update(['is_default' => false]);
        }

        $validated = $this->applyGeography($validated);

        $address = Auth::user()->addresses()->create($validated);

        return response()->json([
            'message' => 'Anuani imehifadhiwa!',
            'address' => $address->load(['forwarder.country', 'forwarderRoute', 'forwarderLocation', 'country', 'state', 'cityRecord'])
        ]);
    }

    public function update(Request $request, UserAddress $address)
    {
        if ($address->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'type' => 'required|in:local,forwarder',
            'address_line' => 'required|string',
            'extra_details' => 'nullable|string',
            'country_id' => 'nullable|exists:countries,id',
            'country_iso2' => 'nullable|string|size:2',
            'country_name' => 'nullable|string|max:120',
            'state_id' => 'nullable|exists:country_states,id',
            'state_name' => 'nullable|string|max:120',
            'city_id' => 'nullable|exists:country_cities,id',
            'city_name' => 'nullable|string|max:120',
            'latitude' => 'nullable|numeric',
            'longitude' => 'nullable|numeric',
            'is_default' => 'boolean',
            'forwarder_id' => 'nullable|exists:forwarders,id',
            'forwarder_route_id' => 'nullable|exists:forwarder_routes,id',
            'forwarder_location_id' => 'nullable|exists:forwarder_locations,id',
            'forwarder_transport_mode' => 'nullable|string|max:80',
            'forwarder_customer_id' => 'nullable|string|max:255',
        ]);

        if ($validated['is_default'] ?? false) {
            Auth::user()->addresses()->where('id', '!=', $address->id)->update(['is_default' => false]);
        }

        if (($validated['type'] ?? null) === 'forwarder' && !empty($validated['forwarder_route_id'])) {
            $route = ForwarderRoute::query()->find($validated['forwarder_route_id']);
            if (!$route?->is_active) {
                return response()->json([
                    'message' => 'This freight route is no longer active. Please choose another active route.',
                ], 422);
            }
        }

        $validated = $this->applyGeography($validated);

        $address->update($validated);

        return response()->json([
            'message' => 'Anuani imesasishwa!',
            'address' => $address->load(['forwarder.country', 'forwarderRoute', 'forwarderLocation', 'country', 'state', 'cityRecord'])
        ]);
    }

    public function destroy(UserAddress $address)
    {
        if ($address->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $address->delete();

        return response()->json(['message' => 'Anuani imefutwa!']);
    }

    public function setDefault(UserAddress $address)
    {
        if ($address->user_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Auth::user()->addresses()->update(['is_default' => false]);
        $address->update(['is_default' => true]);

        return response()->json(['message' => 'Anuani imewekwa kama chaguo msingi!']);
    }

    private function applyGeography(array $validated): array
    {
        $geo = $this->geography->resolve(
            countryId: $validated['country_id'] ?? null,
            countryIso2: $validated['country_iso2'] ?? null,
            countryName: $validated['country_name'] ?? null,
            stateId: $validated['state_id'] ?? null,
            stateName: $validated['state_name'] ?? null,
            cityId: $validated['city_id'] ?? null,
            cityName: $validated['city_name'] ?? null,
        );

        $validated['country_id'] = $validated['country_id'] ?? $geo['country_id'];
        $validated['state_id'] = $validated['state_id'] ?? $geo['state_id'];
        $validated['city_id'] = $validated['city_id'] ?? $geo['city_id'];

        unset($validated['country_iso2'], $validated['country_name'], $validated['state_name'], $validated['city_name']);

        return $validated;
    }
}
