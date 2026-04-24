<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantLocationController extends Controller
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

    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $locations = $merchant->locations()->latest()->get();

        return response()->json([
            'data' => $locations
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

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
        ]);

        if ($validated['is_primary'] ?? false) {
            MerchantLocation::where('merchant_id', $merchant->id)->update(['is_primary' => false]);
        }

        $location = $merchant->locations()->create($validated);

        return response()->json([
            'message' => 'Shop location saved.',
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
        ]);

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
