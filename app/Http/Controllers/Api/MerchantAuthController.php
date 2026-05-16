<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\MerchantRegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Merchant;
use App\Models\Country;
use App\Models\User;
use App\Models\Wallet;
use App\Services\PhoneService;
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
        $otp = $validated['otp'] ?? null;
        $country = Country::find($validated['country_id'] ?? null);
        $currentUser = $request->user() ?: Auth::guard('web')->user();
        if ($currentUser && !$currentUser->email_verified_at) {
            return response()->json([
                'message' => 'Tafadhali unganisha Google kwanza ili kuthibitisha email yako kabla ya kuanza kuuza.',
            ], 403);
        }

        $verifiedCurrentUser = $currentUser
            && $currentUser->phone_number
            && $currentUser->phone_verified_at
            && in_array($currentUser->phone_number, PhoneService::variantsForLookup($phone, $country), true);

        if (!$verifiedCurrentUser) {
            if (!$otp) {
                return response()->json([
                    'message' => 'Nambari ya siri inahitajika.',
                ], 422);
            }

            $cacheKey = "otp:{$phone}";
            $hashedOtp = Cache::get($cacheKey);

            if (!$hashedOtp || !Hash::check($otp, $hashedOtp)) {
                return response()->json([
                    'message' => 'OTP si sahihi au imeisha muda wake.',
                ], 422);
            }

            // Consume OTP (one-time use)
            Cache::forget($cacheKey);
        }

        // Check if phone number is already registered. Older accounts may store
        // local numbers (062...) while new auth requests are normalized to E.164.
        $existingUser = $verifiedCurrentUser ? $currentUser : $this->findUserByPhone($phone, $country);

        if ($existingUser) {
            $user = $existingUser;
            // Upgrade buyer to merchant if they aren't already
            if ($user->role !== 'merchant') {
                $user->role = 'merchant';
                if (empty($user->name) || Str::startsWith($user->name, 'User ')) {
                    $user->name = $validated['display_name'] ?? 'Merchant';
                }
                if (!$user->phone_verified_at) {
                    $user->phone_verified_at = now();
                }
                $user->save();
            } elseif (!$user->phone_verified_at) {
                $user->forceFill(['phone_verified_at' => now()])->save();
            }
        } else {
            // Create new merchant
            $user = User::create([
                'phone_number' => $phone,
                'phone_verified_at' => now(),
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

            $selectedCountry = Country::find($validated['country_id'] ?? $countryId);
            $countryTimezones = $selectedCountry?->timezones() ?? [];
            $timezone = in_array($validated['timezone'] ?? null, $countryTimezones, true)
                ? $validated['timezone']
                : ($selectedCountry?->defaultTimezone() ?? 'Africa/Dar_es_Salaam');

            $merchant = Merchant::create([
                'user_id' => $user->id,
                'username' => $username,
                'display_name' => $validated['display_name'] ?? $user->name,
                'type' => 'personal',
                'is_verified' => false,
                'is_default' => true,
                'country_id' => $validated['country_id'] ?? $countryId,
                'currency_id' => $validated['currency_id'] ?? $currencyId,
                'timezone' => $timezone,
            ]);
        }

        $merchant->wallet()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]
        );


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
        $validated = $request->validate([
            'phone_number' => 'required|string',
            'country_id' => 'nullable|exists:countries,id',
        ]);
        $phone = $validated['phone_number'];

        // Normalize phone for correct lookup
        $sessionCountry = session('user_session_country');
        $region = $sessionCountry['iso_alpha2'] ?? 'TZ';
        $country = $this->countryFromRequest($request, $region);
        $formattedPhone = PhoneService::formatToE164($phone, $country?->iso_alpha2 ?? $region) ?: $phone;

        // Check if country is active
        $isActive = $country ? $country->is_active : true;

        $phoneVariants = PhoneService::variantsForLookup($formattedPhone, $country?->iso_alpha2 ?? $region);
        $user = User::whereIn('phone_number', $phoneVariants)
            ->where(function ($query) {
                $query->where('role', 'merchant')
                    ->orWhereHas('merchantProfiles');
            })
            ->first();

        $exists = (bool) $user;

        return response()->json([
            'is_merchant' => $exists,
            'is_existing_account' => $exists,
            'is_active' => $isActive,
            'country_name' => $country?->name,
            'phone_number' => $user?->phone_number ?? $formattedPhone,
        ]);
    }

    public function ensurePersonalProfile(\Illuminate\Http\Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->phone_number) {
            return response()->json([
                'message' => 'Tafadhali thibitisha nambari ya simu kwanza.',
            ], 403);
        }

        if ($user->role !== 'merchant') {
            $user->role = 'merchant';
            $user->save();
        }

        if (! $user->wallet) {
            Wallet::create(['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]);
        }

        $merchant = Merchant::where('user_id', $user->id)->where('type', 'personal')->first()
            ?? Merchant::where('user_id', $user->id)->first();

        if (! $merchant) {
            $baseUsername = Str::slug($user->name && ! Str::startsWith($user->name, 'User ')
                ? $user->name
                : 'user-' . substr(preg_replace('/\D+/', '', (string) $user->phone_number), -6));
            $baseUsername = $baseUsername ?: 'user';
            $username = $baseUsername;
            $counter = 1;

            while (Merchant::where('username', $username)->exists()) {
                $username = $baseUsername . '-' . $counter;
                $counter++;
            }

            $sessionCountry = session('user_session_country');
            $country = isset($sessionCountry['iso_alpha2'])
                ? Country::where('iso_alpha2', $sessionCountry['iso_alpha2'])->first()
                : null;

            $merchant = Merchant::create([
                'user_id' => $user->id,
                'username' => $username,
                'display_name' => $user->name ?: 'Personal Profile',
                'type' => 'personal',
                'is_verified' => false,
                'is_default' => true,
                'country_id' => $country?->id,
                'currency_id' => $country?->default_currency_id,
                'timezone' => $country?->defaultTimezone() ?? 'Africa/Dar_es_Salaam',
                'kyc_status' => 'unverified',
            ]);
        }

        $merchant->wallet()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]
        );

        session(['active_merchant_id' => $merchant->id]);

        return response()->json([
            'merchant' => $merchant,
            'user' => UserResource::make($user->fresh(['merchantProfiles'])),
        ]);
    }

    private function findUserByPhone(string $phone, Country|string|null $country = null): ?User
    {
        return User::whereIn('phone_number', PhoneService::variantsForLookup($phone, $country))->first();
    }

    private function countryFromRequest(\Illuminate\Http\Request $request, string $fallbackRegion): ?Country
    {
        if ($request->filled('country_id')) {
            return Country::find($request->input('country_id'));
        }

        return Country::where('iso_alpha2', $fallbackRegion)->first();
    }

    /**
     * Add a new business profile for an existing user.
     */
    public function addBusinessProfile(\Illuminate\Http\Request $request): JsonResponse
    {
        $request->validate([
            'display_name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:merchants,username',
            'type' => 'required|string|in:sole_proprietor,business,ngo',
        ]);

        $user = $request->user();

        // Get defaults from existing merchant profile if available
        $baseMerchant = \App\Models\Merchant::where('user_id', $user->id)->first();

        $merchant = \App\Models\Merchant::create([
            'user_id' => $user->id,
            'display_name' => $request->display_name,
            'username' => \Illuminate\Support\Str::slug($request->username),
            'type' => $request->type,
            'is_default' => false,
            'country_id' => $baseMerchant?->country_id,
            'currency_id' => $baseMerchant?->currency_id,
            'timezone' => $baseMerchant?->defaultTimezone(),
            'kyc_status' => 'unverified',
        ]);

        $merchant->wallet()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]
        );

        // Switch to the new profile
        session(['active_merchant_id' => $merchant->id]);

        return response()->json([
            'message' => 'Biashara mpya imeongezwa!',
            'merchant' => $merchant
        ]);
    }
}
