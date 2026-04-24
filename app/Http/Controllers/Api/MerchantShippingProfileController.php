<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use App\Models\ShippingProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantShippingProfileController extends Controller
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
        $profiles = ShippingProfile::where('merchant_id', $merchant->id)
            ->withCount('rates')
            ->latest()
            ->get();

        return response()->json([
            'data' => $profiles
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_default' => 'boolean',
        ]);

        if ($validated['is_default'] ?? false) {
            ShippingProfile::where('merchant_id', $merchant->id)->update(['is_default' => false]);
        }

        // If it's the first profile, make it default anyway
        $count = ShippingProfile::where('merchant_id', $merchant->id)->count();
        if ($count === 0) {
            $validated['is_default'] = true;
        }

        $profile = ShippingProfile::create([
            'merchant_id' => $merchant->id,
            'name' => $validated['name'],
            'is_default' => $validated['is_default'] ?? false,
        ]);

        $profile->rates_count = 0;

        return response()->json([
            'message' => 'Shipping profile created.',
            'data' => $profile
        ]);
    }

    public function update(Request $request, ShippingProfile $shippingProfile): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($shippingProfile->merchant_id !== $merchant->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'is_default' => 'boolean',
        ]);

        if ($validated['is_default'] ?? false) {
            ShippingProfile::where('merchant_id', $merchant->id)
                ->where('id', '!=', $shippingProfile->id)
                ->update(['is_default' => false]);
        }

        $shippingProfile->update($validated);

        return response()->json([
            'message' => 'Shipping profile updated.',
            'data' => $shippingProfile
        ]);
    }

    public function destroy(Request $request, ShippingProfile $shippingProfile): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($shippingProfile->merchant_id !== $merchant->id) {
            abort(403);
        }

        // Don't allow deleting the last profile or the default one if others exist without setting a new default
        $count = ShippingProfile::where('merchant_id', $merchant->id)->count();
        if ($count <= 1) {
            return response()->json(['message' => 'Huwezi kufuta profile yako ya mwisho ya usafirishaji.'], 422);
        }

        $shippingProfile->delete();

        // If we deleted the default, make the most recent one default
        $hasDefault = ShippingProfile::where('merchant_id', $merchant->id)->where('is_default', true)->exists();
        if (!$hasDefault) {
            ShippingProfile::where('merchant_id', $merchant->id)->latest()->first()?->update(['is_default' => true]);
        }

        return response()->json([
            'message' => 'Shipping profile deleted.'
        ]);
    }

    public function setDefault(Request $request, ShippingProfile $shippingProfile): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        if ($shippingProfile->merchant_id !== $merchant->id) {
            abort(403);
        }

        ShippingProfile::where('merchant_id', $merchant->id)->update(['is_default' => false]);
        $shippingProfile->update(['is_default' => true]);

        return response()->json([
            'message' => 'Default shipping profile updated.'
        ]);
    }
}
