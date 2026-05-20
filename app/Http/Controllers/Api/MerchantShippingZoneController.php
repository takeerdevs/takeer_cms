<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Models\ShippingProfile;
use App\Models\ShippingZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MerchantShippingZoneController extends Controller
{
    private function merchantFromRequest(Request $request): Merchant
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            abort(403, 'Merchant profile not found.');
        }
        return $merchant;
    }

    /**
     * Display a listing of the zones for a specific profile.
     */
    public function index(Request $request, ShippingProfile $shippingProfile): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        
        // Use loose comparison to avoid type mismatches (string vs integer)
        if ($shippingProfile->merchant_id != $merchant->id) {
            abort(403, 'Huna idhini ya kufikia profile hii.');
        }

        $zones = ShippingZone::where('shipping_profile_id', $shippingProfile->id)
            ->with(['location', 'hotspots'])
            ->latest()
            ->get();

        return response()->json([
            'profile' => $shippingProfile->only(['id', 'name', 'is_default', 'outside_area_policy']),
            'data' => $zones,
        ]);
    }

    /**
     * Store a newly created shipping zone.
     */
    public function store(Request $request, ShippingProfile $shippingProfile): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($shippingProfile->merchant_id !== $merchant->id) {
            abort(403);
        }

        $validated = $request->validate([
            'zone_name' => 'required|string|max:255',
            'flat_rate_fee' => 'required|numeric|min:0',
            'delivery_type' => 'required|in:local_boda,intercity_bus,self_pickup',
            'is_active' => 'boolean',
            'merchant_location_id' => 'nullable|exists:merchant_locations,id',
            'max_distance_km' => 'nullable|numeric|min:0',
            'reference_lat' => 'nullable|numeric',
            'reference_lng' => 'nullable|numeric',
            'reference_name' => 'nullable|string|max:255',
            'destination_region' => 'nullable|string|max:255',
            'destination_city' => 'nullable|string|max:255',
            'destination_country' => 'nullable|string|max:255',
            'hotspots' => 'nullable|array',
            'hotspots.*.name' => 'required|string|max:255',
            'hotspots.*.latitude' => 'required|numeric',
            'hotspots.*.longitude' => 'required|numeric',
        ]);

        $maxDistanceKm = $validated['max_distance_km'] ?? null;

        $location = null;
        if (!empty($validated['merchant_location_id'])) {
            $location = MerchantLocation::where('id', $validated['merchant_location_id'])
                ->where('merchant_id', $merchant->id)
                ->first();

            if (!$location) {
                return response()->json(['message' => 'Eneo la duka ulilochagua halipo au si lako.'], 422);
            }
        }

        // Specific logic based on delivery_type
        if ($validated['delivery_type'] === 'local_boda') {
            if (empty($validated['merchant_location_id'])) {
                return response()->json(['message' => 'Tafadhali chagua eneo la duka kwa ajili ya usafirishaji wa boda.'], 422);
            }
            
            // If reference point is provided, calculate distance automatically
            if (!empty($validated['reference_lat']) && !empty($validated['reference_lng'])) {
                $shop = $location ?: MerchantLocation::where('id', $validated['merchant_location_id'])
                    ->where('merchant_id', $merchant->id)
                    ->first();
                
                if (!$shop) {
                    return response()->json(['message' => 'Eneo la duka halikupatikana.'], 404);
                }

                $maxDistanceKm = ShippingZone::calculateDistance(
                    $shop->latitude, $shop->longitude,
                    $validated['reference_lat'], $validated['reference_lng']
                );
            } elseif (!isset($validated['max_distance_km'])) {
                return response()->json(['message' => 'Tafadhali weka umbali au chagua eneo kwenye ramani kwa ajili ya boda.'], 422);
            }
        } elseif ($validated['delivery_type'] === 'intercity_bus') {
            if (empty($validated['destination_region'])) {
                return response()->json(['message' => 'Tafadhali weka mkoa unakoenda kwa ajili ya basi.'], 422);
            }
        }

        $zone = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $shippingProfile->id,
            'merchant_location_id' => $validated['merchant_location_id'] ?? null,
            'zone_name' => $validated['zone_name'],
            'flat_rate_fee' => $validated['flat_rate_fee'],
            'max_distance_km' => $maxDistanceKm,
            'reference_lat' => $validated['reference_lat'] ?? null,
            'reference_lng' => $validated['reference_lng'] ?? null,
            'reference_name' => $validated['reference_name'] ?? null,
            'destination_region' => $validated['destination_region'] ?? null,
            'destination_city' => $validated['destination_city'] ?? null,
            'destination_country' => $validated['destination_country'] ?? null,
            'delivery_type' => $validated['delivery_type'],
            'is_active' => $validated['is_active'] ?? true,
        ]);

        if (!empty($validated['hotspots'])) {
            foreach ($validated['hotspots'] as $hs) {
                $zone->hotspots()->create([
                    'name' => $hs['name'],
                    'latitude' => $hs['latitude'],
                    'longitude' => $hs['longitude'],
                ]);
            }
        }

        return response()->json([
            'message' => 'Njia ya usafirishaji imeongezwa kikamilifu.',
            'data' => $zone->load(['location', 'hotspots']),
        ], 201);
    }

    /**
     * Update the specified shipping zone.
     */
    public function update(Request $request, ShippingZone $shippingZone): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($shippingZone->merchant_id !== $merchant->id) {
            return response()->json(['message' => 'Unaingilia data za mtu mwingine.'], 403);
        }

        $validated = $request->validate([
            'zone_name' => 'sometimes|string|max:255',
            'flat_rate_fee' => 'sometimes|numeric|min:0',
            'delivery_type' => 'sometimes|in:local_boda,intercity_bus,self_pickup',
            'is_active' => 'boolean',
            'merchant_location_id' => 'nullable|exists:merchant_locations,id',
            'max_distance_km' => 'nullable|numeric|min:0',
            'reference_lat' => 'nullable|numeric',
            'reference_lng' => 'nullable|numeric',
            'reference_name' => 'nullable|string|max:255',
            'destination_region' => 'nullable|string|max:255',
            'destination_city' => 'nullable|string|max:255',
            'destination_country' => 'nullable|string|max:255',
            'hotspots' => 'nullable|array',
            'hotspots.*.name' => 'required|string|max:255',
            'hotspots.*.latitude' => 'required|numeric',
            'hotspots.*.longitude' => 'required|numeric',
        ]);

        if ($shippingZone->delivery_type === 'local_boda' || (isset($validated['delivery_type']) && $validated['delivery_type'] === 'local_boda')) {
            $locId = $validated['merchant_location_id'] ?? $shippingZone->merchant_location_id;
            $refLat = $validated['reference_lat'] ?? $shippingZone->reference_lat;
            $refLng = $validated['reference_lng'] ?? $shippingZone->reference_lng;
            
            if ($locId && $refLat && $refLng) {
                $shop = MerchantLocation::where('id', $locId)
                    ->where('merchant_id', $merchant->id)
                    ->first();
                if (!$shop) {
                    return response()->json(['message' => 'Eneo la duka ulilochagua halipo au si lako.'], 422);
                }
                $validated['max_distance_km'] = ShippingZone::calculateDistance(
                    $shop->latitude, $shop->longitude,
                    $refLat, $refLng
                );
            }
        }

        if (array_key_exists('merchant_location_id', $validated) && !empty($validated['merchant_location_id'])) {
            $locOk = MerchantLocation::where('id', $validated['merchant_location_id'])
                ->where('merchant_id', $merchant->id)
                ->exists();
            if (!$locOk) {
                return response()->json(['message' => 'Eneo la duka ulilochagua halipo au si lako.'], 422);
            }
        }

        $shippingZone->update($validated);

        if (isset($validated['hotspots'])) {
            $shippingZone->hotspots()->delete();
            foreach ($validated['hotspots'] as $hs) {
                $shippingZone->hotspots()->create([
                    'name' => $hs['name'],
                    'latitude' => $hs['latitude'],
                    'longitude' => $hs['longitude'],
                ]);
            }
        }

        return response()->json([
            'message' => 'Taarifa za usafirishaji zimesasishwa.',
            'data' => $shippingZone->load(['location', 'hotspots']),
        ]);
    }

    /**
     * Remove the specified shipping zone.
     */
    public function destroy(Request $request, ShippingZone $shippingZone): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($shippingZone->merchant_id !== $merchant->id) {
            return response()->json(['message' => 'Unaingilia data za mtu mwingine.'], 403);
        }

        $shippingZone->delete();

        return response()->json([
            'message' => 'Usafirishaji umezimwa kikamilifu.',
        ]);
    }
}
