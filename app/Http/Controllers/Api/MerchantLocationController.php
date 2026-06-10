<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Support\GeographyResolver;
use App\Support\MerchantPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantLocationController extends Controller
{
    public function __construct(private GeographyResolver $geography)
    {
    }

    private function normalizeLocationType(?string $type): ?string
    {
        if (!$type) return null;

        return match (strtolower(trim($type))) {
            'shop' => 'SHOP',
            'store' => 'STORE',
            'warehouse' => 'WAREHOUSE',
            default => null,
        };
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

    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $locationsQuery = $merchant->locations()->latest();
        $assignedLocationId = MerchantPermissions::assignedLocationIdFor($request->user(), $merchant);

        if ($assignedLocationId !== null) {
            $locationsQuery->where('id', $assignedLocationId);
        }

        $locations = $locationsQuery->with(['country', 'state', 'cityRecord'])->get();

        return response()->json([
            'data' => $locations
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        if ($merchant->type === 'personal' && $merchant->locations()->exists()) {
            return response()->json([
                'message' => 'Personal account inaweza kuwa na eneo moja tu la stock/pickup. Hariri eneo lililopo au verify business account kama unahitaji maeneo mengi.',
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'required|string',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'place_id' => 'nullable|string',
            'country_id' => 'nullable|exists:countries,id',
            'country_iso2' => 'nullable|string|size:2',
            'country_name' => 'nullable|string|max:120',
            'state_id' => 'nullable|exists:country_states,id',
            'state_name' => 'nullable|string|max:120',
            'city_id' => 'nullable|exists:country_cities,id',
            'city_name' => 'nullable|string|max:120',
            'city' => 'nullable|string',
            'region' => 'nullable|string',
            'is_primary' => 'boolean',
            'allow_self_pickup' => 'boolean',
            'pickup_hold_hours' => 'nullable|integer|min:1|max:8760',
            'pickup_grace_hours' => 'nullable|integer|min:0|max:8760',
            'pickup_available_windows' => 'nullable|array',
            'pickup_available_windows.*.day' => 'required_with:pickup_available_windows|integer|min:1|max:7',
            'pickup_available_windows.*.enabled' => 'nullable|boolean',
            'pickup_available_windows.*.start' => 'required_with:pickup_available_windows|date_format:H:i',
            'pickup_available_windows.*.end' => 'required_with:pickup_available_windows|date_format:H:i',
            'pickup_instructions' => 'nullable|string|max:2000',
            'pickup_holding_fee_enabled' => 'boolean',
            'pickup_late_fee_type' => 'nullable|string|in:fixed,hourly',
            'pickup_holding_fee_amount' => 'nullable|numeric|min:0',
            'pickup_late_fee_cap_amount' => 'nullable|numeric|min:0',
            'pickup_cancellation_penalty_percent' => 'nullable|numeric|min:0|max:100',
            'pickup_holding_fee_interval' => 'nullable|string|in:hour,day,week',
            'pickup_max_holding_days' => 'nullable|integer|min:0|max:365',
            'contact_phone' => 'nullable|string|max:50',
            'type' => 'nullable|string',
        ]);

        if (array_key_exists('type', $validated)) {
            $validated['type'] = $this->normalizeLocationType($validated['type']);
            if (! $validated['type']) {
                return response()->json(['message' => 'Aina ya eneo si sahihi.'], 422);
            }
        }

        $validated = $this->normalizePickupPolicy($validated);

        if ($validated['is_primary'] ?? false) {
            MerchantLocation::where('merchant_id', $merchant->id)->update(['is_primary' => false]);
        }

        $validated = $this->applyGeography($validated);
        $location = $merchant->locations()->create($validated);

        if ($merchant->isBusinessProfile()) {
            \App\Models\MerchantStaff::firstOrCreate([
                'merchant_id' => $merchant->id,
                'user_id' => $merchant->user_id,
                'assigned_location_id' => $location->id,
            ], [
                'role' => 'MANAGER',
                'pin_hash' => \Illuminate\Support\Facades\Hash::make('0000'),
                'is_active' => true,
            ]);
        }

        return response()->json([
            'message' => $merchant->type === 'personal' ? 'Stock/pickup point saved.' : 'Shop location saved.',
            'data' => $location->load(['country', 'state', 'cityRecord'])
        ]);
    }

    public function update(Request $request, MerchantLocation $merchantLocation): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($merchantLocation->merchant_id !== $merchant->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'required|string',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'place_id' => 'nullable|string',
            'country_id' => 'nullable|exists:countries,id',
            'country_iso2' => 'nullable|string|size:2',
            'country_name' => 'nullable|string|max:120',
            'state_id' => 'nullable|exists:country_states,id',
            'state_name' => 'nullable|string|max:120',
            'city_id' => 'nullable|exists:country_cities,id',
            'city_name' => 'nullable|string|max:120',
            'city' => 'nullable|string',
            'region' => 'nullable|string',
            'is_primary' => 'boolean',
            'allow_self_pickup' => 'boolean',
            'pickup_hold_hours' => 'nullable|integer|min:1|max:8760',
            'pickup_grace_hours' => 'nullable|integer|min:0|max:8760',
            'pickup_available_windows' => 'nullable|array',
            'pickup_available_windows.*.day' => 'required_with:pickup_available_windows|integer|min:1|max:7',
            'pickup_available_windows.*.enabled' => 'nullable|boolean',
            'pickup_available_windows.*.start' => 'required_with:pickup_available_windows|date_format:H:i',
            'pickup_available_windows.*.end' => 'required_with:pickup_available_windows|date_format:H:i',
            'pickup_instructions' => 'nullable|string|max:2000',
            'pickup_holding_fee_enabled' => 'boolean',
            'pickup_late_fee_type' => 'nullable|string|in:fixed,hourly',
            'pickup_holding_fee_amount' => 'nullable|numeric|min:0',
            'pickup_late_fee_cap_amount' => 'nullable|numeric|min:0',
            'pickup_cancellation_penalty_percent' => 'nullable|numeric|min:0|max:100',
            'pickup_holding_fee_interval' => 'nullable|string|in:hour,day,week',
            'pickup_max_holding_days' => 'nullable|integer|min:0|max:365',
            'contact_phone' => 'nullable|string|max:50',
            'type' => 'nullable|string',
        ]);

        if (array_key_exists('type', $validated)) {
            $validated['type'] = $this->normalizeLocationType($validated['type']);
            if (! $validated['type']) {
                return response()->json(['message' => 'Aina ya eneo si sahihi.'], 422);
            }
        }

        $validated = $this->normalizePickupPolicy($validated);

        if ($validated['is_primary'] ?? false) {
            MerchantLocation::where('merchant_id', $merchant->id)
                ->where('id', '!=', $merchantLocation->id)
                ->update(['is_primary' => false]);
        }

        $validated = $this->applyGeography($validated);
        $merchantLocation->update($validated);

        return response()->json([
            'message' => 'Shop location updated.',
            'data' => $merchantLocation->load(['country', 'state', 'cityRecord'])
        ]);
    }

    public function destroy(Request $request, MerchantLocation $merchantLocation): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($merchantLocation->merchant_id !== $merchant->id) {
            abort(403);
        }

        $merchantLocation->delete();

        return response()->json([
            'message' => 'Shop location deleted.'
        ]);
    }

    private function applyGeography(array $validated): array
    {
        $geo = $this->geography->resolve(
            countryId: $validated['country_id'] ?? null,
            countryIso2: $validated['country_iso2'] ?? null,
            countryName: $validated['country_name'] ?? null,
            stateId: $validated['state_id'] ?? null,
            stateName: $validated['state_name'] ?? $validated['region'] ?? null,
            cityId: $validated['city_id'] ?? null,
            cityName: $validated['city_name'] ?? $validated['city'] ?? null,
        );

        $validated['country_id'] = $validated['country_id'] ?? $geo['country_id'];
        $validated['state_id'] = $validated['state_id'] ?? $geo['state_id'];
        $validated['city_id'] = $validated['city_id'] ?? $geo['city_id'];
        $validated['region'] = $validated['region'] ?? $geo['state_name'];
        $validated['city'] = $validated['city'] ?? $geo['city_name'];

        unset($validated['country_iso2'], $validated['country_name'], $validated['state_name'], $validated['city_name']);

        return $validated;
    }

    private function normalizePickupPolicy(array $validated): array
    {
        $validated['pickup_available_windows'] = $this->sanitizePickupWindows($validated['pickup_available_windows'] ?? null);

        $validated['pickup_hold_hours'] = 2;
        $validated['pickup_grace_hours'] = 0;
        $validated['pickup_holding_fee_enabled'] = false;
        $validated['pickup_late_fee_type'] = 'fixed';
        $validated['pickup_holding_fee_amount'] = null;
        $validated['pickup_late_fee_cap_amount'] = null;
        $validated['pickup_holding_fee_interval'] = 'day';

        return $validated;
    }

    private function sanitizePickupWindows(?array $windows): ?array
    {
        if (!$windows) {
            return null;
        }

        $clean = collect($windows)
            ->map(function ($window) {
                $day = (int) ($window['day'] ?? 0);
                $start = (string) ($window['start'] ?? '');
                $end = (string) ($window['end'] ?? '');

                if ($day < 1 || $day > 7 || !preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end) || $start >= $end) {
                    return null;
                }

                return [
                    'day' => $day,
                    'enabled' => (bool) ($window['enabled'] ?? true),
                    'start' => $start,
                    'end' => $end,
                ];
            })
            ->filter()
            ->sortBy([['day', 'asc'], ['start', 'asc']])
            ->values()
            ->all();

        return $clean ?: null;
    }
}
