<?php

namespace App\Payments\Drivers\AzamPay;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Manages AzamPay bearer token lifecycle.
 *
 * AzamPay requires two credentials per API call:
 *   1. Bearer token  — obtained via /AppRegistration/GenerateToken (expires in ~24h)
 *   2. X-API-Key     — your static app token (AZAMPAY_TOKEN in .env)
 *
 * This service handles (1): it fetches, caches the bearer token in Redis,
 * and auto-refreshes it 30 minutes before expiry.
 */
class AzamPayTokenService
{
    private const CACHE_KEY = 'azampay:bearer_token';
    private const TTL_SECONDS = 82_800; // 23h — refresh 1h before AzamPay's 24h expiry

    public function __construct(
        private readonly string $authenticatorBaseUrl,
        private readonly string $clientId,
        private readonly string $clientSecret,
        private readonly string $appName,
    ) {}

    /**
     * Get a valid bearer token, fetching from AzamPay if the cached one is stale.
     */
    public function getToken(): string
    {
        return Cache::remember(self::CACHE_KEY, self::TTL_SECONDS, function () {
            return $this->fetchFreshToken();
        });
    }

    /**
     * Force-refresh the token (call this if a 401 is received mid-session).
     */
    public function refreshToken(): string
    {
        Cache::forget(self::CACHE_KEY);
        return $this->getToken();
    }

    /**
     * POST to AzamPay's auth server to get a new bearer token.
     */
    private function fetchFreshToken(): string
    {
        Log::info('AzamPay: Fetching fresh bearer token.');

        $response = Http::timeout(15)
            ->post("{$this->authenticatorBaseUrl}/AppRegistration/GenerateToken", [
                'appName'      => $this->appName,
                'clientId'     => $this->clientId,
                'clientSecret' => $this->clientSecret,
            ]);

        if (!$response->successful()) {
            Log::error('AzamPay: Token generation failed.', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            throw new RuntimeException('AzamPay token generation failed: ' . $response->body());
        }

        $data = $response->json();

        // AzamPay returns: { "data": { "accessToken": "...", ... } }
        $token = $data['data']['accessToken'] ?? null;

        if (empty($token)) {
            Log::error('AzamPay: Unexpected token response structure.', ['response' => $data]);
            throw new RuntimeException('AzamPay returned an unexpected token response.');
        }

        Log::info('AzamPay: Bearer token obtained and cached.');

        return $token;
    }
}
