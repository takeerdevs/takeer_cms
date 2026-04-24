<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\MerchantRegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class MerchantAuthController extends Controller
{
    /**
     * Register a new merchant and verify OTP.
     */
    public function register(MerchantRegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $phone = $validated['phone_number'];
        $otp = $validated['otp'];

        $cacheKey = "otp:{$phone}";
        $hashedOtp = Cache::get($cacheKey);

        if (!$hashedOtp || !Hash::check($otp, $hashedOtp)) {
            return response()->json([
                'message' => 'OTP si sahihi au imeisha muda wake.',
            ], 422);
        }

        // Consume OTP (one-time use)
        Cache::forget($cacheKey);

        // Check if phone number is already registered
        $existingUser = User::where('phone_number', $phone)->first();

        if ($existingUser) {
            $user = $existingUser;
            // Upgrade buyer to merchant if they aren't already
            if ($user->role !== 'merchant') {
                $user->role = 'merchant';
                if (empty($user->name) || Str::startsWith($user->name, 'User ')) {
                    $user->name = $validated['display_name'] ?? 'Merchant';
                }
                $user->save();
            }
        } else {
            // Create new merchant
            $user = User::create([
                'phone_number' => $phone,
                'name' => $validated['display_name'] ?? 'Merchant',
                'role' => 'merchant',
            ]);
        }

        // Ensure wallet exists
        if (!$user->wallet) {
            Wallet::create(['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]);
        }

        // Ensure merchant profile exists
        $merchant = Merchant::where('user_id', $user->id)->first();

        if (!$merchant) {
            // Generate a unique username slug for minstore
            $baseUsername = Str::slug($validated['store_name'] ?? 'shop');
            $username = $baseUsername;
            $counter = 1;
            while (Merchant::where('username', $username)->exists()) {
                $username = $baseUsername . '-' . $counter;
                $counter++;
            }

            // GeoIP auto-detection pre-fill fallback
            $sessionCountry = session('user_session_country');
            $countryId = null;
            $currencyId = null;

            if ($sessionCountry && isset($sessionCountry['iso_alpha2'])) {
                $country = \App\Models\Country::where('iso_alpha2', $sessionCountry['iso_alpha2'])->first();
                if ($country) {
                    $countryId = $country->id;
                    $currencyId = $country->default_currency_id;
                }
            }

            if (!$currencyId && session()->has('user_session_currency')) {
                $currencyCode = session('user_session_currency');
                $currency = \App\Models\Currency::where('code', $currencyCode)->first();
                if ($currency) {
                    $currencyId = $currency->id;
                }
            }

            $merchant = Merchant::create([
                'user_id' => $user->id,
                'username' => $username,
                'display_name' => $validated['display_name'] ?? $user->name,
                'is_verified' => false,
                'is_default' => true,
                'country_id' => $validated['country_id'] ?? $countryId,
                'currency_id' => $validated['currency_id'] ?? $currencyId,
            ]);
        }


        // Revoke old tokens
        $user->tokens()->delete();
        $token = $user->createToken('takeer-merchant-app')->plainTextToken;

        Auth::login($user, true);

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user->fresh(['merchantProfiles'])),
            'merchant_profile' => $merchant,
        ]);
    }

    /**
     * Check if phone number is already a registered merchant.
     */
    public function check(\Illuminate\Http\Request $request): JsonResponse
    {
        $phone = $request->validate(['phone_number' => 'required|string'])['phone_number'];

        // Normalize phone for correct lookup
        $sessionCountry = session('user_session_country');
        $region = $sessionCountry['iso_alpha2'] ?? 'TZ';
        $formattedPhone = \App\Services\PhoneService::formatToE164($phone, $region) ?: $phone;

        $exists = User::where('phone_number', $formattedPhone)
                      ->where('role', 'merchant')
                      ->exists();

        return response()->json(['is_merchant' => $exists]);
    }
}
