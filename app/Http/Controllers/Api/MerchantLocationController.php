<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Support\MerchantPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantLocationController extends Controller
{
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

        $locations = $locationsQuery->get();

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
            'city' => 'nullable|string',
            'region' => 'nullable|string',
            'is_primary' => 'boolean',
            'allow_self_pickup' => 'boolean',
            'contact_phone' => 'nullable|string|max:50',
            'type' => 'nullable|string|in:shop,store,warehouse',
        ]);

        if (array_key_exists('type', $validated)) {
            $validated['type'] = $this->normalizeLocationType($validated['type']);
        }

        if ($validated['is_primary'] ?? false) {
            MerchantLocation::where('merchant_id', $merchant->id)->update(['is_primary' => false]);
        }

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
            'data' => $location
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
            'city' => 'nullable|string',
            'region' => 'nullable|string',
            'is_primary' => 'boolean',
            'allow_self_pickup' => 'boolean',
            'contact_phone' => 'nullable|string|max:50',
            'type' => 'nullable|string|in:shop,store,warehouse',
        ]);

        if (array_key_exists('type', $validated)) {
            $validated['type'] = $this->normalizeLocationType($validated['type']);
        }

        if ($validated['is_primary'] ?? false) {
            MerchantLocation::where('merchant_id', $merchant->id)
                ->where('id', '!=', $merchantLocation->id)
                ->update(['is_primary' => false]);
        }

        $merchantLocation->update($validated);

        return response()->json([
            'message' => 'Shop location updated.',
            'data' => $merchantLocation
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
}
