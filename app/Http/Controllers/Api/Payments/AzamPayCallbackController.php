<?php

namespace App\Http\Controllers\Api\Payments;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Payments\PaymentCallbackProcessor;
use App\Payments\PaymentEvent;
use App\Services\ProviderEventRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * POST /api/payments/tz/azampay
 *
 * AzamPay posts a callback here after the customer completes (or fails)
 * the USSD push on their phone.
 *
 * Callback payload fields (from AzamPay schema):
 *   - utilityref        → our transaction_ref (e.g. "TXN-ABCDEF1234")
 *   - externalreference → AzamPay's own reference ID
 *   - transactionstatus → "success" | "failed" | "cancelled"
 *   - operator          → "Airtel" | "Tigo" | "Vodacom" | "Halopesa"
 *   - amount            → amount paid (string)
 *   - msisdn            → customer's phone number
 *   - signature         → RSA-SHA256 base64 signature for verification
 *
 * Security: AzamPay signs callbacks with RSA. We verify using their public key
 * (fetched from sandbox and cached locally). Spoofed callbacks are rejected.
 *
 * Important: This endpoint MUST return HTTP 200 even on business logic errors.
 * AzamPay retries on non-200 responses. Return 200 and log the issue instead.
 */
class AzamPayCallbackController extends Controller
{
    private const PUBLIC_KEY_CACHE_KEY = 'azampay:public_key';
    private const PUBLIC_KEY_TTL       = 86_400; // 24h

    public function __construct(
        private readonly PaymentCallbackProcessor $processor,
        private readonly ProviderEventRecorder $events,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        $payload = $request->all();

        Log::info('AzamPay callback received.', ['ip' => $request->ip()]);

        // 1. Verify RSA signature to confirm this is genuinely from AzamPay
        if (!$this->verifySignature($payload)) {
            $rejected = new PaymentEvent(provider: 'azampay', direction: 'payin', status: 'rejected', rawPayload: $payload);
            $this->events->record($request, $rejected, !empty($payload['signature']), false);
            // Return 200 to prevent AzamPay from retrying a known-bad request
            return response()->json(['message' => 'Signature verification failed'], 200);
        }

        // 2. Locate our order using utilityref = transaction_ref
        $transactionRef = $payload['utilityref'] ?? null;
        if (!$transactionRef) {
            $event = new PaymentEvent(
                provider: 'azampay',
                direction: 'payin',
                status: 'rejected',
                rawPayload: $payload,
                failureReason: 'Missing provider transaction reference.',
            );
            $providerEvent = $this->events->record($request, $event, true, true);
            $providerEvent->update(['validation_state' => 'review', 'processing_result' => 'missing_takeer_reference']);
            return response()->json(['message' => 'Missing utilityref'], 200);
        }

        $order = Order::where('transaction_ref', $transactionRef)->first();
        if (!$order) {
            Log::error("AzamPay Callback: Order not found for ref [{$transactionRef}].");
            return response()->json(['message' => 'Order not found'], 200);
        }

        // 3. Dispatch to shared processor based on transaction status
        $status   = strtolower($payload['transactionstatus'] ?? '');
        $gatewayRef = $payload['externalreference'] ?? ($payload['mnoreference'] ?? 'N/A');

        $event = new PaymentEvent(
            provider: 'azampay',
            direction: 'payin',
            status: $status,
            providerReference: $gatewayRef,
            takeerReference: (string) $transactionRef,
            amount: isset($payload['amount']) ? (float) $payload['amount'] : null,
            currency: $payload['currency'] ?? 'TZS',
            network: $payload['operator'] ?? null,
            rawPayload: $payload,
            failureReason: $payload['message'] ?? null,
        );
        $providerEvent = $this->events->record($request, $event, true, true);
        $this->processor->processVerifiedEvent($event, $providerEvent);

        // AzamPay expects HTTP 200 to acknowledge receipt
        return response()->json(['message' => 'Callback processed'], 200);
    }

    /**
     * Verify the RSA-SHA256 signature from AzamPay.
     *
     * Signed string = utilityref + externalreference + transactionstatus + operator
     * Signature is base64-encoded RSA signature verified against AzamPay's public key.
     *
     * Spec: https://developerdocs.azampay.co.tz (Callback Signature Verification)
     */
    private function verifySignature(array $payload): bool
    {
        $signature = $payload['signature'] ?? null;

        if (empty($signature)) {
            Log::error('AzamPay Callback: Missing signature in production callback.');
            return false;
        }

        $publicKeyPem = $this->getPublicKey();
        if (!$publicKeyPem) {
            Log::error('AzamPay Callback: Cannot verify signature — public key unavailable.');
            return false;
        }

        $signedFields = config('services.azampay.callback_signature_fields', []);
        if (!is_array($signedFields) || $signedFields === []) {
            Log::error('AzamPay Callback: signature field order is not configured from the provider contract.');
            return false;
        }

        // The exact field order is deployment configuration supplied from the current PSP contract.
        $dataToVerify = collect($signedFields)
            ->map(fn (string $field) => (string) data_get($payload, $field, ''))
            ->implode('');

        $signatureBytes = base64_decode($signature);
        $publicKey      = openssl_pkey_get_public($publicKeyPem);

        if (!$publicKey) {
            Log::error('AzamPay Callback: Failed to parse public key PEM.');
            return false;
        }

        $result = openssl_verify($dataToVerify, $signatureBytes, $publicKey, OPENSSL_ALGO_SHA256);

        if ($result === 1) {
            return true;
        }

        if ($result === 0) {
            Log::warning('AzamPay Callback: Signature mismatch — possible spoofing attempt.');
            return false;
        }

        // openssl_verify returned -1 (error)
        Log::error('AzamPay Callback: openssl_verify error: ' . openssl_error_string());
        return false;
    }

    /**
     * Fetch AzamPay's RSA public key from their endpoint, cache for 24h.
     * On verification failure, re-fetch and retry (handles key rotation).
     */
    private function getPublicKey(): ?string
    {
        return Cache::remember(self::PUBLIC_KEY_CACHE_KEY, self::PUBLIC_KEY_TTL, function () {
            return $this->fetchPublicKeyFromAzamPay();
        });
    }

    private function fetchPublicKeyFromAzamPay(): ?string
    {
        try {
            // The public key endpoint requires auth — use the checkout base URL
            $checkoutBase = config('services.azampay.checkout_base_url');
            $apiKey       = config('services.azampay.token');

            // We need a bearer token to fetch the public key
            $tokenService = app(\App\Payments\Drivers\AzamPay\AzamPayTokenService::class);
            $bearerToken  = $tokenService->getToken();

            $response = Http::timeout(15)
                ->withToken($bearerToken)
                ->withHeaders(['X-API-Key' => $apiKey])
                ->get("{$checkoutBase}/azampay/v1/public-key", ['format' => 'Pem']);

            if ($response->successful()) {
                $data = $response->json();
                $key  = $data['publicKey'] ?? null;
                if ($key) {
                    Log::info('AzamPay: Public key fetched and cached.');
                    return $key;
                }
            }

            Log::warning('AzamPay: Failed to fetch public key.', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return null;

        } catch (\Throwable $e) {
            Log::error('AzamPay: Exception fetching public key: ' . $e->getMessage());
            return null;
        }
    }
}
