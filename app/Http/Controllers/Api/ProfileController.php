<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    /**
     * POST /api/profile/one-click/setup
     * Creates or updates the user's 1-tap checkout profile.
     */
    public function setupOneClick(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'payment_provider' => 'required|in:mpesa,tigopesa,airtel',
            'payment_number' => 'required|string|regex:/^\+255[0-9]{9}$/',
            'delivery_zone_id' => 'nullable|exists:shipping_zones,id',
            'delivery_landmark' => 'nullable|string|max:255',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
        ], [
            'payment_number.regex' => 'Nambari lazima ianze na +255',
        ]);

        $profile = $request->user()->oneClickProfile()->updateOrCreate(
            ['user_id' => $request->user()->id],
            $validated
        );

        return response()->json([
            'message' => 'Profaili yako ya malipo ya haraka imehifadhiwa.',
            'profile' => $profile,
        ]);
    }
}
