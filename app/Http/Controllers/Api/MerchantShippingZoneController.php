<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Models\ShippingProfile;
use App\Models\ShippingZone;
use App\Support\GeographyResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MerchantShippingZoneController extends Controller
{
    public function __construct(private GeographyResolver $geography)
    {
    }

    private function merchantFromRequest(Request $request): Merchant
    {
        if ($request->attributes->has('active_merchant')) {
            return $request->attributes->get('active_merchant');
        }

        $user = $request->user();
        $merchantId = $request->input('merchant_id') ?? session('active_merchant_id');

        if ($merchantId) {
            $merchant = $user->merchantProfiles()
                ->where('merchants.id', $merchantId)
                ->first();

            abort_unless($merchant, 403, 'Unauthorized merchant context.');

            return $merchant;
        }

        $merchant = $user->merchantProfiles()->where('is_active', true)->first()
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
            ->with(['location', 'hotspots', 'destinationCountryRecord', 'destinationStateRecord', 'destinationCityRecord'])
            ->latest()
            ->get();

        return response()->json([
            'profile' => $shippingProfile->only(['id', 'name', 'is_default', 'outside_area_policy', 'in_city_enabled', 'intercity_enabled', 'international_enabled']),
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
            'coverage_scope' => 'nullable|in:distance_band,city_region,countrywide,international,pickup',
            'is_active' => 'boolean',
            'merchant_location_id' => 'nullable|exists:merchant_locations,id',
            'max_distance_km' => 'nullable|numeric|min:0',
            'reference_lat' => 'nullable|numeric',
            'reference_lng' => 'nullable|numeric',
            'reference_name' => 'nullable|string|max:255',
            'destination_region' => 'nullable|string|max:255',
            'destination_city' => 'nullable|string|max:255',
            'destination_country' => 'nullable|string|max:255',
            'destination_country_id' => 'nullable|exists:countries,id',
            'destination_state_id' => 'nullable|exists:country_states,id',
            'destination_city_id' => 'nullable|exists:country_cities,id',
            'handling_min_days' => 'nullable|integer|min:0|max:365',
            'handling_max_days' => 'nullable|integer|min:0|max:365|gte:handling_min_days',
            'transit_min_days' => 'nullable|integer|min:0|max:365',
            'transit_max_days' => 'nullable|integer|min:0|max:365|gte:transit_min_days',
            'cutoff_time' => 'nullable|date_format:H:i',
            'business_days_only' => 'boolean',
            'delivery_promise_label' => 'nullable|string|max:255',
            'delivery_promise_note' => 'nullable|string|max:1000',
            'requires_delivery_confirmation' => 'boolean',
            'hotspots' => 'nullable|array',
            'hotspots.*.name' => 'required|string|max:255',
            'hotspots.*.latitude' => 'required|numeric',
            'hotspots.*.longitude' => 'required|numeric',
        ]);

        $maxDistanceKm = $validated['max_distance_km'] ?? null;
        $coverageScope = $this->resolveCoverageScope($validated['delivery_type'], $validated['coverage_scope'] ?? null);
        $destinationGeo = $this->resolveDestinationGeo($validated);

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
            if ($coverageScope === 'countrywide') {
                $validated['destination_country_id'] = $destinationGeo['country_id'] ?: $merchant->country_id;
                $validated['destination_country'] = $destinationGeo['country_name'] ?: $merchant->country?->name;
                $validated['destination_state_id'] = null;
                $validated['destination_city_id'] = null;
                $validated['destination_region'] = null;
                $validated['destination_city'] = null;
                $validated['reference_name'] = $validated['reference_name'] ?: 'Country-wide delivery';
            } elseif ($coverageScope === 'international') {
                if (empty($destinationGeo['country_id']) && empty($validated['destination_country'])) {
                    return response()->json(['message' => 'Tafadhali weka nchi unayoweza kusafirisha kwenda.'], 422);
                }
                $validated['destination_country_id'] = $destinationGeo['country_id'];
                $validated['destination_country'] = $destinationGeo['country_name'] ?: $validated['destination_country'];
                $validated['destination_state_id'] = null;
                $validated['destination_city_id'] = null;
                $validated['destination_region'] = null;
                $validated['destination_city'] = null;
                $validated['reference_name'] = $validated['reference_name'] ?: $validated['destination_country'];
            } elseif (empty($validated['destination_region']) && empty($validated['destination_city']) && empty($validated['reference_name'])) {
                return response()->json(['message' => 'Tafadhali weka destination au mkoa unakoenda kwa ajili ya inter-city.'], 422);
            }

            if ($coverageScope === 'city_region') {
                $validated['destination_region'] = ($validated['destination_region'] ?? null)
                    ?: (($validated['destination_city'] ?? null)
                    ?: (($validated['reference_name'] ?? null) ?: null));
                $destinationGeo = $this->resolveDestinationGeo($validated);
                $validated['destination_country_id'] = $destinationGeo['country_id'] ?: $merchant->country_id;
                $validated['destination_country'] = $destinationGeo['country_name'] ?: ($validated['destination_country'] ?? $merchant->country?->name);
                $validated['destination_state_id'] = $destinationGeo['state_id'];
                $validated['destination_city_id'] = $destinationGeo['city_id'];
                $validated['destination_region'] = $destinationGeo['state_name'] ?: ($validated['destination_region'] ?? null);
                $validated['destination_city'] = $destinationGeo['city_name'] ?: ($validated['destination_city'] ?? null);
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
            'destination_country_id' => $validated['destination_country_id'] ?? null,
            'destination_state_id' => $validated['destination_state_id'] ?? null,
            'destination_city_id' => $validated['destination_city_id'] ?? null,
            'delivery_type' => $validated['delivery_type'],
            'coverage_scope' => $coverageScope,
            'is_active' => $validated['is_active'] ?? true,
            'handling_min_days' => $validated['handling_min_days'] ?? null,
            'handling_max_days' => $validated['handling_max_days'] ?? null,
            'transit_min_days' => $validated['transit_min_days'] ?? null,
            'transit_max_days' => $validated['transit_max_days'] ?? null,
            'cutoff_time' => $validated['cutoff_time'] ?? null,
            'business_days_only' => $validated['business_days_only'] ?? true,
            'delivery_promise_label' => $validated['delivery_promise_label'] ?? null,
            'delivery_promise_note' => $validated['delivery_promise_note'] ?? null,
            'requires_delivery_confirmation' => $validated['requires_delivery_confirmation'] ?? false,
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
            'data' => $zone->load(['location', 'hotspots', 'destinationCountryRecord', 'destinationStateRecord', 'destinationCityRecord']),
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
            'coverage_scope' => 'nullable|in:distance_band,city_region,countrywide,international,pickup',
            'is_active' => 'boolean',
            'merchant_location_id' => 'nullable|exists:merchant_locations,id',
            'max_distance_km' => 'nullable|numeric|min:0',
            'reference_lat' => 'nullable|numeric',
            'reference_lng' => 'nullable|numeric',
            'reference_name' => 'nullable|string|max:255',
            'destination_region' => 'nullable|string|max:255',
            'destination_city' => 'nullable|string|max:255',
            'destination_country' => 'nullable|string|max:255',
            'destination_country_id' => 'nullable|exists:countries,id',
            'destination_state_id' => 'nullable|exists:country_states,id',
            'destination_city_id' => 'nullable|exists:country_cities,id',
            'handling_min_days' => 'nullable|integer|min:0|max:365',
            'handling_max_days' => 'nullable|integer|min:0|max:365|gte:handling_min_days',
            'transit_min_days' => 'nullable|integer|min:0|max:365',
            'transit_max_days' => 'nullable|integer|min:0|max:365|gte:transit_min_days',
            'cutoff_time' => 'nullable|date_format:H:i',
            'business_days_only' => 'boolean',
            'delivery_promise_label' => 'nullable|string|max:255',
            'delivery_promise_note' => 'nullable|string|max:1000',
            'requires_delivery_confirmation' => 'boolean',
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

        $deliveryType = $validated['delivery_type'] ?? $shippingZone->delivery_type;
        $coverageScope = $this->resolveCoverageScope($deliveryType, $validated['coverage_scope'] ?? $shippingZone->coverage_scope ?? null);
        $validated['coverage_scope'] = $coverageScope;
        $destinationGeo = $this->resolveDestinationGeo($validated);

        if ($deliveryType === 'intercity_bus') {
            if ($coverageScope === 'countrywide') {
                $validated['destination_country_id'] = $destinationGeo['country_id'] ?: $shippingZone->destination_country_id ?: $merchant->country_id;
                $validated['destination_country'] = $destinationGeo['country_name'] ?: ($validated['destination_country'] ?? $shippingZone->destination_country ?? $merchant->country?->name);
                $validated['destination_state_id'] = null;
                $validated['destination_city_id'] = null;
                $validated['destination_region'] = null;
                $validated['destination_city'] = null;
                $validated['reference_name'] = $validated['reference_name'] ?? $shippingZone->reference_name ?? 'Country-wide delivery';
            } elseif ($coverageScope === 'international') {
                $destinationCountryName = $destinationGeo['country_name'] ?: ($validated['destination_country'] ?? $shippingZone->destination_country);
                if (!$destinationCountryName) {
                    return response()->json(['message' => 'Tafadhali weka nchi unayoweza kusafirisha kwenda.'], 422);
                }
                $validated['destination_country_id'] = $destinationGeo['country_id'] ?: $shippingZone->destination_country_id;
                $validated['destination_country'] = $destinationCountryName;
                $validated['destination_state_id'] = null;
                $validated['destination_city_id'] = null;
                $validated['destination_region'] = null;
                $validated['destination_city'] = null;
                $validated['reference_name'] = $validated['reference_name'] ?? $shippingZone->reference_name ?? $destinationCountryName;
            } elseif (empty($validated['destination_region']) && empty($validated['destination_city']) && empty($validated['reference_name'])) {
                return response()->json(['message' => 'Tafadhali weka destination au mkoa unakoenda kwa ajili ya inter-city.'], 422);
            }

            if ($coverageScope === 'city_region') {
                $validated['destination_region'] = ($validated['destination_region'] ?? null)
                    ?: (($validated['destination_city'] ?? null)
                    ?: (($validated['reference_name'] ?? null) ?: $shippingZone->destination_region));
                $destinationGeo = $this->resolveDestinationGeo($validated);
                $validated['destination_country_id'] = $destinationGeo['country_id'] ?: $shippingZone->destination_country_id ?: $merchant->country_id;
                $validated['destination_country'] = $destinationGeo['country_name'] ?: ($validated['destination_country'] ?? $shippingZone->destination_country ?? $merchant->country?->name);
                $validated['destination_state_id'] = $destinationGeo['state_id'] ?: $shippingZone->destination_state_id;
                $validated['destination_city_id'] = $destinationGeo['city_id'] ?: $shippingZone->destination_city_id;
                $validated['destination_region'] = $destinationGeo['state_name'] ?: ($validated['destination_region'] ?? $shippingZone->destination_region);
                $validated['destination_city'] = $destinationGeo['city_name'] ?: ($validated['destination_city'] ?? $shippingZone->destination_city);
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
            'data' => $shippingZone->load(['location', 'hotspots', 'destinationCountryRecord', 'destinationStateRecord', 'destinationCityRecord']),
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

    private function resolveCoverageScope(string $deliveryType, ?string $coverageScope): string
    {
        if ($coverageScope) {
            return $coverageScope;
        }

        return match ($deliveryType) {
            'local_boda' => 'distance_band',
            'self_pickup' => 'pickup',
            default => 'city_region',
        };
    }

    private function resolveDestinationGeo(array $validated): array
    {
        $geo = $this->geography->resolve(
            countryId: $validated['destination_country_id'] ?? null,
            countryIso2: null,
            countryName: $validated['destination_country'] ?? null,
            stateId: $validated['destination_state_id'] ?? null,
            stateName: $validated['destination_region'] ?? null,
            cityId: $validated['destination_city_id'] ?? null,
            cityName: $validated['destination_city'] ?? null,
        );

        return [
            'country_id' => $validated['destination_country_id'] ?? $geo['country_id'],
            'state_id' => $validated['destination_state_id'] ?? $geo['state_id'],
            'city_id' => $validated['destination_city_id'] ?? $geo['city_id'],
            'country_name' => $geo['country_name'] ?? null,
            'state_name' => $geo['state_name'] ?? null,
            'city_name' => $geo['city_name'] ?? null,
        ];
    }
}
