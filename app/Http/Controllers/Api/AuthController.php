<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SendOtpRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\Wallet;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
class AuthController extends Controller
{
    public function __construct(private SmsService $smsService)
    {
    }

    /**
     * Send a 6-digit OTP to the given phone number.
     * Rate-limited in routes: 5 requests / 10 minutes per IP.
     */
    public function sendOtp(SendOtpRequest $request): JsonResponse
    {
        $phone = $request->validated('phone_number');

        // Generate 6-digit OTP
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Log::info("OTP sent to {$phone}: {$otp}");

        // Store in cache for 5 minutes (key scoped to phone)
        Cache::put("otp:{$phone}", Hash::make($otp), now()->addMinutes(5));

        // Fire OTP via Beem Africa (non-blocking — logs internally)
        $this->smsService->sendOtp($phone, $otp);

        return response()->json([
            'message' => 'OTP imtumwa kwa nambari yako ya simu.',
            'expires_in_seconds' => 300,
        ]);
    }

    /**
     * Verify OTP and return a Sanctum API token.
     * Creates user (buyer) if they don't exist yet.
     */
    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        ['phone_number' => $phone, 'otp' => $otp] = $request->validated();

        $cacheKey = "otp:{$phone}";
        $hashedOtp = Cache::get($cacheKey);

        if (!$hashedOtp || !Hash::check($otp, $hashedOtp)) {
            return response()->json([
                'message' => 'OTP si sahihi au imeisha muda wake.',
            ], 422);
        }

        // Consume OTP (one-time use)
        Cache::forget($cacheKey);

        // Find or create user
        $user = User::firstOrCreate(
            ['phone_number' => $phone],
            [
                'name' => 'User ' . substr($phone, -4),
                'role' => 'buyer',
            ]
        );

        // Create wallet if this is their first login
        if (!$user->wallet) {
            Wallet::create(['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]);
        }

        // Revoke old tokens to prevent accumulation (one active session per user)
        $user->tokens()->delete();

        $token = $user->createToken('takeer-app')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user),
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
}
