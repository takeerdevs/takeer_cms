<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Merchant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantSettingsController extends Controller
{
    /**
     * Update the merchant's store settings.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchant) {
            return response()->json(['message' => 'Huna akaunti ya muuzaji.'], 403);
        }

        $validated = $request->validate([
            'display_name' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:1000',
            'country_id' => 'nullable|exists:countries,id',
            'currency_id' => 'nullable|exists:currencies,id',
            'is_active' => 'nullable|boolean',
        ]);

        if (isset($validated['display_name'])) {
            $merchant->display_name = $validated['display_name'];
        }
        if (isset($validated['bio'])) {
            $merchant->bio = $validated['bio'];
        }
        if (isset($validated['country_id'])) {
            $merchant->country_id = $validated['country_id'];
        }
        if (isset($validated['currency_id'])) {
            $merchant->currency_id = $validated['currency_id'];
        }
        if (isset($validated['is_active'])) {
            $merchant->is_active = $validated['is_active'];
        }

        $merchant->save();

        return response()->json([
            'message' => 'Mipangilio ya biashara imehifadhiwa.',
            'merchant' => $merchant->fresh(),
        ]);
    }
}
