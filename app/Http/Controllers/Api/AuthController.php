<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\Country;
use App\Services\PhoneService;
use App\Services\SmsService;
use App\Services\StepUpVerificationService;
use App\Services\TotpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    private const OTP_SEND_PHONE_MAX_ATTEMPTS = 3;
    private const OTP_SEND_IP_MAX_ATTEMPTS = 30;
    private const OTP_SEND_DECAY_SECONDS = 600;
    private const OTP_VERIFY_MAX_ATTEMPTS = 5;
    private const OTP_VERIFY_DECAY_SECONDS = 600;
    private const TOTP_LOGIN_MAX_ATTEMPTS = 5;
    private const TOTP_LOGIN_DECAY_SECONDS = 600;

    public function __construct(private SmsService $smsService)
    {
    }

    /**
     * Send a 6-digit OTP to the given phone number.
     * Rate-limited by phone and IP so load-balanced deployments do not
     * accidentally punish every user behind the same proxy address.
     */
    public function sendOtp(SendOtpRequest $request): JsonResponse
    {
        $phone = $request->validated('phone_number');
        $purpose = (string) $request->input('purpose', 'general');
        $user = $this->findUserByPhone($phone, $request);
        $isLoginPurpose = $purpose === 'login';
        $isRecoveryPurpose = $purpose === 'totp_recovery';

        if ($isLoginPurpose && $user?->hasEnabledTotp()) {
            return response()->json([
                'message' => 'Authenticator app imewashwa kwa akaunti hii.',
                'requires_totp' => true,
                'phone_number' => $user->phone_number,
            ]);
        }

        if ($isRecoveryPurpose && (! $user || ! $user->hasEnabledTotp())) {
            return response()->json([
                'message' => 'Account recovery haihitajiki kwa akaunti hii.',
            ], 422);
        }

        $phoneKey = 'otp-send:phone:' . sha1($phone);
        $ipKey = 'otp-send:ip:' . sha1((string) $request->ip());

        if (
            RateLimiter::tooManyAttempts($phoneKey, self::OTP_SEND_PHONE_MAX_ATTEMPTS)
            || RateLimiter::tooManyAttempts($ipKey, self::OTP_SEND_IP_MAX_ATTEMPTS)
        ) {
            return response()->json([
                'message' => 'Umeomba OTP mara nyingi sana. Tafadhali subiri kidogo kisha ujaribu tena.',
                'retry_after_seconds' => max(
                    RateLimiter::availableIn($phoneKey),
                    RateLimiter::availableIn($ipKey),
                ),
            ], 429);
        }

        // Generate 6-digit OTP
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store in cache for 5 minutes (key scoped to phone)
        Cache::put($this->otpCacheKey($phone, $purpose), Hash::make($otp), now()->addMinutes(5));

        // Fire OTP via Beem Africa (non-blocking — logs internally)
        $this->smsService->sendOtp($phone, $otp, $user?->id);
        RateLimiter::hit($phoneKey, self::OTP_SEND_DECAY_SECONDS);
        RateLimiter::hit($ipKey, self::OTP_SEND_DECAY_SECONDS);

        return response()->json([
            'message' => $isRecoveryPurpose
                ? 'Recovery OTP imetumwa kwa nambari yako ya simu.'
                : 'OTP imtumwa kwa nambari yako ya simu.',
            'expires_in_seconds' => 300,
            'recovery_mode' => $isRecoveryPurpose,
        ]);
    }

    /**
     * Verify OTP and return a Sanctum API token.
     * Creates user (buyer) if they don't exist yet.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        ['phone_number' => $phone, 'otp' => $otp] = $request->validated();
        $purpose = (string) $request->input('purpose', 'general');

        $throttleKey = 'otp-verify:' . sha1($request->ip() . '|' . $phone);
        if (RateLimiter::tooManyAttempts($throttleKey, self::OTP_VERIFY_MAX_ATTEMPTS)) {
            return response()->json([
                'message' => 'Umejaribu mara nyingi sana. Tafadhali subiri kidogo kisha ujaribu tena.',
                'retry_after_seconds' => RateLimiter::availableIn($throttleKey),
            ], 429);
        }

        $cacheKey = $this->otpCacheKey($phone, $purpose);
        $hashedOtp = Cache::get($cacheKey);

        if (!$hashedOtp || !Hash::check($otp, $hashedOtp)) {
            RateLimiter::hit($throttleKey, self::OTP_VERIFY_DECAY_SECONDS);

            return response()->json([
                'message' => 'OTP si sahihi au imeisha muda wake.',
            ], 422);
        }

        // Consume OTP (one-time use)
        Cache::forget($cacheKey);
        RateLimiter::clear($throttleKey);

        $country = $request->filled('country_id') ? Country::find($request->input('country_id')) : null;
        $user = User::whereIn('phone_number', PhoneService::variantsForLookup($phone, $country))->first();

        if ($purpose === 'login' && $user?->hasEnabledTotp()) {
            return response()->json([
                'message' => 'Tumia authenticator code kuingia kwenye akaunti hii.',
                'requires_totp' => true,
            ], 409);
        }

        $twoFactorWasReset = false;
        if ($purpose === 'totp_recovery') {
            if (! $user || ! $user->hasEnabledTotp()) {
                return response()->json([
                    'message' => 'Account recovery haihitajiki kwa akaunti hii.',
                ], 422);
            }

            $user->forceFill([
                'two_factor_secret' => null,
                'two_factor_recovery_codes' => null,
                'two_factor_confirmed_at' => null,
            ])->save();

            $twoFactorWasReset = true;
        }

        if (! $user) {
            $user = User::create([
                'phone_number' => $phone,
                'phone_verified_at' => now(),
                'name' => 'User ' . substr($phone, -4),
                'role' => 'buyer',
            ]);
        } elseif (!$user->phone_verified_at) {
            $user->forceFill(['phone_verified_at' => now()])->save();
        }

        $token = $this->completeLogin($request, $user);

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user),
            'two_factor_reset' => $twoFactorWasReset,
            'message' => $twoFactorWasReset
                ? '2FA imeondolewa. Tafadhali weka authenticator mpya baada ya kuingia.'
                : 'Umefanikiwa kuingia.',
        ]);
    }

    public function verifyTotpLogin(Request $request, TotpService $totp): JsonResponse
    {
        $validated = $request->validate([
            'phone_number' => ['required', 'string', 'max:20'],
            'code' => ['required', 'string', 'max:32'],
            'country_id' => ['nullable', 'exists:countries,id'],
        ]);

        $phone = $this->normalizePhone($validated['phone_number'], $request);
        $user = $this->findUserByPhone($phone, $request);

        if (! $user || ! $user->hasEnabledTotp()) {
            return response()->json([
                'message' => 'Authenticator app haijawekwa kwa akaunti hii.',
            ], 422);
        }

        $throttleKey = 'totp-login:' . sha1($request->ip() . '|' . $user->id);
        if (RateLimiter::tooManyAttempts($throttleKey, self::TOTP_LOGIN_MAX_ATTEMPTS)) {
            return response()->json([
                'message' => 'Umejaribu mara nyingi sana. Tafadhali subiri kidogo kisha ujaribu tena.',
                'retry_after_seconds' => RateLimiter::availableIn($throttleKey),
            ], 429);
        }

        if (! ($totp->verify($user, $validated['code']) || $totp->consumeRecoveryCode($user, $validated['code']))) {
            RateLimiter::hit($throttleKey, self::TOTP_LOGIN_DECAY_SECONDS);

            return response()->json([
                'message' => 'Authenticator au recovery code si sahihi.',
            ], 422);
        }

        RateLimiter::clear($throttleKey);
        $token = $this->completeLogin($request, $user);

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user->fresh()),
            'message' => 'Umefanikiwa kuingia.',
        ]);
    }

    /**
     * Logout — revoke current token.
     */
    public function logout(): \Illuminate\Http\RedirectResponse|JsonResponse
    {

        $user = request()->user();
        if ($user && method_exists($user, 'currentAccessToken') && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        // Explicitly logout from session-based guard if it exists
        if (auth()->guard('web')->check()) {
            auth()->guard('web')->logout();
            request()->session()->invalidate();
            request()->session()->regenerateToken();
        }

        if (request()->wantsJson() && !request()->header('X-Inertia')) {
            return response()->json(['message' => 'Umefanikiwa kutoka.']);
        }

        return redirect()->route('login');
    }

    /**
     * Convert a valid Sanctum token auth into a persistent web session auth.
     * Used after guest quick checkout so Inertia pages immediately reflect unlocked content.
     */
    public function bootstrapSession(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        Auth::guard('web')->login($user, true);
        $request->session()->regenerate();

        return response()->json([
            'ok' => true,
            'user' => UserResource::make($user->fresh('merchantProfiles')),
        ]);
    }

    private function completeLogin(Request $request, User $user): string
    {
        $user->tokens()->delete();
        $token = $user->createToken('takeer-app')->plainTextToken;

        Auth::guard('web')->login($user, true);
        $request->session()->regenerate();

        return $token;
    }

    private function findUserByPhone(string $phone, Request $request): ?User
    {
        $country = $request->filled('country_id') ? Country::find($request->input('country_id')) : null;

        return User::whereIn('phone_number', PhoneService::variantsForLookup($phone, $country))->first();
    }

    private function normalizePhone(string $phone, Request $request): string
    {
        $region = 'TZ';
        if ($request->filled('country_id')) {
            $region = Country::whereKey($request->input('country_id'))->value('iso_alpha2') ?: 'TZ';
        } else {
            $sessionCountry = $request->session()->get('user_session_country');
            $region = $sessionCountry['iso_alpha2'] ?? 'TZ';
        }

        return PhoneService::formatToE164($phone, $region) ?: $phone;
    }

    private function otpCacheKey(string $phone, string $purpose): string
    {
        return $purpose === 'totp_recovery'
            ? "otp:totp-recovery:{$phone}"
            : "otp:{$phone}";
    }

    public function sendStepUpCode(Request $request, StepUpVerificationService $stepUp): JsonResponse
    {
        $validated = $request->validate([
            'purpose' => ['required', 'string', 'max:80'],
        ]);

        $result = $stepUp->send($request->user(), $validated['purpose'], $request->ip());

        return response()->json(
            collect($result)->except('status', 'ok')->all(),
            (int) ($result['status'] ?? 200),
        );
    }

    public function verifyStepUpCode(Request $request, StepUpVerificationService $stepUp): JsonResponse
    {
        $validated = $request->validate([
            'purpose' => ['required', 'string', 'max:80'],
            'code' => ['required', 'string', 'max:32'],
        ]);

        if (! $stepUp->verify($request, $validated['purpose'], $validated['code'])) {
            return response()->json([
                'message' => 'Verification code si sahihi au imeisha muda wake.',
            ], 422);
        }

        return response()->json([
            'message' => 'Security check imekamilika.',
            'verified' => true,
        ]);
    }

    public function startTotpSetup(Request $request, TotpService $totp): JsonResponse
    {
        $user = $request->user();
        if ($user->hasEnabledTotp()) {
            return response()->json([
                'message' => 'Authenticator app is already enabled. Disable it before starting a new setup.',
            ], 409);
        }

        $secret = $totp->generateSecret();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json($totp->provisioningPayload($user, $secret));
    }

    public function confirmTotpSetup(Request $request, TotpService $totp): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();
        if (! $totp->verify($user, $validated['code'])) {
            return response()->json([
                'message' => 'Authenticator code si sahihi. Hakikisha muda wa simu yako uko sawa.',
            ], 422);
        }

        $recoveryCodes = $totp->generateRecoveryCodes();
        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $totp->hashRecoveryCodes($recoveryCodes),
        ])->save();

        return response()->json([
            'message' => 'Authenticator app imewashwa.',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function regenerateTotpRecoveryCodes(Request $request, TotpService $totp): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32'],
        ]);

        $user = $request->user();
        if (! $user->hasEnabledTotp() || ! $totp->verify($user, $validated['code'])) {
            return response()->json([
                'message' => 'Authenticator code si sahihi.',
            ], 422);
        }

        $recoveryCodes = $totp->generateRecoveryCodes();
        $user->forceFill([
            'two_factor_recovery_codes' => $totp->hashRecoveryCodes($recoveryCodes),
        ])->save();

        return response()->json([
            'message' => 'Recovery codes mpya zimetengenezwa.',
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function disableTotp(Request $request, TotpService $totp): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32'],
        ]);

        $user = $request->user();
        if (! $user->hasEnabledTotp() || ! ($totp->verify($user, $validated['code']) || $totp->consumeRecoveryCode($user, $validated['code']))) {
            return response()->json([
                'message' => 'Verification code si sahihi.',
            ], 422);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json([
            'message' => 'Authenticator app imezimwa.',
        ]);
    }
}
