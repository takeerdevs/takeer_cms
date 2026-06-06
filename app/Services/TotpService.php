<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class TotpService
{
    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    private const DIGITS = 6;
    private const PERIOD = 30;

    public function generateSecret(int $length = 32): string
    {
        $secret = '';
        $bytes = random_bytes($length);

        for ($i = 0; $i < $length; $i++) {
            $secret .= self::BASE32_ALPHABET[ord($bytes[$i]) % strlen(self::BASE32_ALPHABET)];
        }

        return $secret;
    }

    public function provisioningPayload(User $user, string $secret): array
    {
        $issuer = $this->issuer();
        $label = rawurlencode($issuer . ':' . ($user->email ?: $user->phone_number ?: 'user-' . $user->id));
        $uri = "otpauth://totp/{$label}?secret={$secret}&issuer=" . rawurlencode($issuer) . '&algorithm=SHA1&digits=' . self::DIGITS . '&period=' . self::PERIOD;
        $svg = (string) QrCode::format('svg')->size(220)->margin(1)->generate($uri);

        return [
            'secret' => $secret,
            'uri' => $uri,
            'qr_svg' => $svg,
        ];
    }

    public function verify(User $user, string $code, ?string $secret = null): bool
    {
        $normalized = preg_replace('/\D/', '', $code);
        if (strlen((string) $normalized) !== self::DIGITS) {
            return false;
        }

        $secret = $secret ?: (string) $user->two_factor_secret;
        if ($secret === '') {
            return false;
        }

        $counter = intdiv(time(), self::PERIOD);
        foreach ([-1, 0, 1] as $window) {
            if (hash_equals($this->code($secret, $counter + $window), (string) $normalized)) {
                return true;
            }
        }

        return false;
    }

    public function generateRecoveryCodes(int $count = 8): array
    {
        return collect(range(1, $count))
            ->map(fn () => Str::upper(Str::random(5) . '-' . Str::random(5)))
            ->all();
    }

    public function hashRecoveryCodes(array $codes): array
    {
        return collect($codes)
            ->map(fn (string $code) => Hash::make($this->normalizeRecoveryCode($code)))
            ->all();
    }

    public function consumeRecoveryCode(User $user, string $code): bool
    {
        $normalized = $this->normalizeRecoveryCode($code);
        $hashes = collect($user->two_factor_recovery_codes ?: []);
        $matchIndex = $hashes->search(fn (string $hash) => Hash::check($normalized, $hash));

        if ($matchIndex === false) {
            return false;
        }

        $remaining = $hashes->reject(fn ($_hash, int $index) => $index === $matchIndex)->values()->all();
        $user->forceFill(['two_factor_recovery_codes' => $remaining])->save();

        return true;
    }

    private function code(string $secret, int $counter): string
    {
        $key = $this->base32Decode($secret);
        $binaryCounter = pack('N*', 0) . pack('N*', $counter);
        $hash = hash_hmac('sha1', $binaryCounter, $key, true);
        $offset = ord(substr($hash, -1)) & 0x0f;
        $value = unpack('N', substr($hash, $offset, 4))[1] & 0x7fffffff;

        return str_pad((string) ($value % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    private function base32Decode(string $secret): string
    {
        $secret = strtoupper(preg_replace('/[^A-Z2-7]/', '', $secret));
        $buffer = 0;
        $bitsLeft = 0;
        $output = '';

        foreach (str_split($secret) as $char) {
            $value = strpos(self::BASE32_ALPHABET, $char);
            if ($value === false) {
                continue;
            }

            $buffer = ($buffer << 5) | $value;
            $bitsLeft += 5;

            if ($bitsLeft >= 8) {
                $bitsLeft -= 8;
                $output .= chr(($buffer >> $bitsLeft) & 0xff);
            }
        }

        return $output;
    }

    private function normalizeRecoveryCode(string $code): string
    {
        return Str::upper(str_replace(' ', '', trim($code)));
    }

    private function issuer(): string
    {
        return trim((string) config('app.name', 'Takeer')) ?: 'Takeer';
    }
}
