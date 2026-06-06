<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class StepUpVerificationService
{
    private const CODE_TTL_MINUTES = 5;
    private const VERIFIED_TTL_MINUTES = 15;
    private const SEND_MAX_ATTEMPTS = 3;
    private const VERIFY_MAX_ATTEMPTS = 5;
    private const DECAY_SECONDS = 600;

    public function __construct(private SmsService $smsService, private TotpService $totpService)
    {
    }

    public function send(User $user, string $purpose, ?string $ip = null): array
    {
        $phone = (string) $user->phone_number;
        if ($user->hasEnabledTotp()) {
            return [
                'ok' => true,
                'message' => 'Tumia verification code kutoka kwenye authenticator app yako.',
                'requires_totp' => true,
                'status' => 200,
            ];
        }

        if ($phone === '') {
            return ['ok' => false, 'message' => 'A verified phone number is required for this security check.', 'status' => 422];
        }

        $sendKey = $this->sendThrottleKey($user, $purpose, $ip);
        if (RateLimiter::tooManyAttempts($sendKey, self::SEND_MAX_ATTEMPTS)) {
            return [
                'ok' => false,
                'message' => 'Umeomba verification code mara nyingi sana. Subiri kidogo kisha ujaribu tena.',
                'retry_after_seconds' => RateLimiter::availableIn($sendKey),
                'status' => 429,
            ];
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        Cache::put($this->codeKey($user, $purpose), Hash::make($code), now()->addMinutes(self::CODE_TTL_MINUTES));
        $this->smsService->sendOtp($phone, $code, (int) $user->id);
        RateLimiter::hit($sendKey, self::DECAY_SECONDS);

        return [
            'ok' => true,
            'message' => 'Verification code imetumwa kwenye simu yako.',
            'expires_in_seconds' => self::CODE_TTL_MINUTES * 60,
            'status' => 200,
        ];
    }

    public function verify(Request $request, string $purpose, string $code): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        if ($user->hasEnabledTotp()) {
            if ($this->totpService->verify($user, $code) || $this->totpService->consumeRecoveryCode($user, $code)) {
                $this->markVerified($request, $purpose);
                return true;
            }

            return false;
        }

        $verifyKey = $this->verifyThrottleKey($user, $purpose, $request->ip());
        if (RateLimiter::tooManyAttempts($verifyKey, self::VERIFY_MAX_ATTEMPTS)) {
            return false;
        }

        $cacheKey = $this->codeKey($user, $purpose);
        $hashedCode = Cache::get($cacheKey);

        if (! $hashedCode || ! Hash::check($code, $hashedCode)) {
            RateLimiter::hit($verifyKey, self::DECAY_SECONDS);
            return false;
        }

        Cache::forget($cacheKey);
        RateLimiter::clear($verifyKey);
        $this->markVerified($request, $purpose);

        return true;
    }

    public function recentlyVerified(Request $request, string $purpose, int $minutes = self::VERIFIED_TTL_MINUTES): bool
    {
        $verifiedAt = (int) $request->session()->get($this->sessionKey($purpose), 0);

        return $verifiedAt > 0 && now()->diffInMinutes(\Carbon\Carbon::createFromTimestamp($verifiedAt)) < $minutes;
    }

    public function markVerified(Request $request, string $purpose): void
    {
        $request->session()->put($this->sessionKey($purpose), now()->timestamp);
    }

    private function codeKey(User $user, string $purpose): string
    {
        return 'step-up-code:' . $this->normalizePurpose($purpose) . ':' . $user->id;
    }

    private function sessionKey(string $purpose): string
    {
        return 'step_up_verified_at.' . $this->normalizePurpose($purpose);
    }

    private function sendThrottleKey(User $user, string $purpose, ?string $ip): string
    {
        return 'step-up-send:' . $this->normalizePurpose($purpose) . ':' . $user->id . ':' . sha1((string) $ip);
    }

    private function verifyThrottleKey(User $user, string $purpose, ?string $ip): string
    {
        return 'step-up-verify:' . $this->normalizePurpose($purpose) . ':' . $user->id . ':' . sha1((string) $ip);
    }

    private function normalizePurpose(string $purpose): string
    {
        return Str::slug($purpose ?: 'critical-action', '_');
    }
}
