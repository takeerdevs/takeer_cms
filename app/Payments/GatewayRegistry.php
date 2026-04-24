<?php

namespace App\Payments;

use App\Payments\Contracts\PaymentGatewayInterface;
use App\Services\GeoLocationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Resolves the correct payment gateway for a given country.
 *
 * Country resolution priority (for mobile money):
 *   1. Phone number prefix   → most reliable for mobile money (+255 → TZ)
 *   2. GeoIP session cache   → already set by DetectUserCountry middleware
 *   3. Live GeoIP lookup     → fresh lookup if no session
 *   4. Config default        → last resort
 *
 * Adding a new country or gateway:
 *   - Register it in config/payment_gateways.php
 *   - Create a class implementing PaymentGatewayInterface under app/Payments/Drivers/
 *   - The registry auto-discovers it — no changes here needed.
 *
 * Future: replace config file with a DB-backed payment_gateways table
 * managed via the admin dashboard. Only this class needs updating.
 */
class GatewayRegistry
{
    /**
     * Map of phone prefix → ISO country code.
     * Covers major mobile money markets. Extend as you expand.
     */
    private const PHONE_PREFIX_MAP = [
        '+255' => 'TZ', // Tanzania
        '+254' => 'KE', // Kenya
        '+256' => 'UG', // Uganda
        '+250' => 'RW', // Rwanda
        '+233' => 'GH', // Ghana
        '+234' => 'NG', // Nigeria  (Flutterwave, Paystack)
        '+27'  => 'ZA', // South Africa
        '+1'   => 'US', // USA / Canada
        '+44'  => 'GB', // UK
    ];

    public function __construct(
        private readonly GeoLocationService $geoLocationService,
    ) {}

    /**
     * Resolve the best available gateway for the incoming request.
     *
     * @param  Request      $request
     * @param  string|null  $phoneNumber  E.g. "+255784123456"
     * @return PaymentGatewayInterface
     * @throws RuntimeException If no gateway is configured for the detected country
     */
    public function resolve(Request $request, ?string $phoneNumber = null): PaymentGatewayInterface
    {
        $countryCode = $this->resolveCountry($request, $phoneNumber);

        return $this->resolveForCountry($countryCode);
    }

    /**
     * Resolve the best gateway explicitly for a known country code.
     * Useful in callback handlers where country is already known.
     */
    public function resolveForCountry(string $countryCode): PaymentGatewayInterface
    {
        $gateways = config('payment_gateways.' . strtoupper($countryCode), []);

        // Filter enabled gateways, sort by priority (lower number = higher priority)
        $enabled = collect($gateways)
            ->filter(fn($g) => $g['enabled'] ?? false)
            ->sortBy('priority')
            ->values();

        if ($enabled->isEmpty()) {
            Log::warning("PaymentGatewayRegistry: No enabled gateway for country [{$countryCode}]");
            throw new RuntimeException("No payment gateway configured for country: {$countryCode}");
        }

        // Pick the highest-priority enabled gateway
        $config = $enabled->first();

        return $this->makeDriver($config['driver'], $config);
    }

    /**
     * Determine country code using layered resolution.
     */
    public function resolveCountry(Request $request, ?string $phoneNumber = null): string
    {
        // 1. Phone prefix — most reliable for mobile money
        if ($phoneNumber) {
            $detected = $this->countryFromPhone($phoneNumber);
            if ($detected) {
                Log::debug("GatewayRegistry: Country [{$detected}] resolved from phone prefix.");
                return $detected;
            }
        }

        // 2. GeoIP session (already detected by DetectUserCountry middleware on web requests)
        $sessionCountry = $request->session()->get('user_session_country.iso_alpha2');
        if ($sessionCountry) {
            Log::debug("GatewayRegistry: Country [{$sessionCountry}] resolved from session.");
            return strtoupper($sessionCountry);
        }

        // 3. Live GeoIP lookup (for API requests without session / card payments)
        $ip = $this->getRealIp($request);
        $geo = $this->geoLocationService->getCountry($ip);
        if ($geo && !empty($geo['iso_code'])) {
            Log::debug("GatewayRegistry: Country [{$geo['iso_code']}] resolved from live GeoIP for ip [{$ip}].");
            return strtoupper($geo['iso_code']);
        }

        // 4. Default fallback (Tanzania for now — adjust via config)
        $default = config('payment_gateways.default_country', 'TZ');
        Log::warning("GatewayRegistry: Could not detect country, falling back to [{$default}].");
        return $default;
    }

    /**
     * Detect country from a full international phone number.
     * Tries longest prefix first to avoid ambiguity (e.g. '+1868' vs '+1').
     */
    private function countryFromPhone(string $phone): ?string
    {
        // Normalize: strip spaces/dashes, ensure starts with +
        $phone = preg_replace('/[\s\-\(\)]/', '', $phone);
        if (!str_starts_with($phone, '+')) {
            return null;
        }

        // Try longest prefix first (up to 4 chars after +)
        for ($len = 4; $len >= 2; $len--) {
            $prefix = substr($phone, 0, $len);
            if (isset(self::PHONE_PREFIX_MAP[$prefix])) {
                return self::PHONE_PREFIX_MAP[$prefix];
            }
        }

        return null;
    }

    /**
     * Instantiate the gateway driver class for the given config entry.
     */
    private function makeDriver(string $driverName, array $config): PaymentGatewayInterface
    {
        // Driver class map — add new drivers here as you expand
        $driverMap = [
            'azampay' => \App\Payments\Drivers\AzamPay\AzamPayGateway::class,
            'flutterwave'   => \App\Payments\Drivers\Flutterwave\FlutterwaveGateway::class,
            // 'mpesa_ke'      => \App\Payments\Drivers\Mpesa\MpesaKeGateway::class,
            // 'stripe'        => \App\Payments\Drivers\Stripe\StripeGateway::class,
        ];

        if (!isset($driverMap[$driverName])) {
            throw new RuntimeException("Unknown payment gateway driver: [{$driverName}]");
        }

        return app($driverMap[$driverName]);
    }

    /**
     * Extract the real client IP, respecting CDN/proxy headers.
     * (Mirrors DetectUserCountry::getRealClientIp logic.)
     */
    private function getRealIp(Request $request): string
    {
        if (!app()->environment('production')) {
            return '169.255.184.29'; // Tanzania test IP in dev/local
        }

        foreach (['CF-Connecting-IP', 'True-Client-IP', 'X-Real-IP'] as $header) {
            if ($val = $request->header($header)) {
                return $val;
            }
        }

        if ($xff = $request->header('X-Forwarded-For')) {
            $ips = array_map('trim', explode(',', $xff));
            if (!empty($ips[0])) return $ips[0];
        }

        return $request->ip();
    }
}
