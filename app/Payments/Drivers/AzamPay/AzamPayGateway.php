<?php

namespace App\Payments\Drivers\AzamPay;

use App\Models\Order;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\PaymentResult;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * AzamPay payment gateway driver — Tanzania.
 *
 * Supports Mobile Network Operators (MNO) checkout:
 *   - Vodacom (M-Pesa TZ)  → prefix 074, 075, 076
 *   - Airtel               → prefix 078, 068, 069
 *   - Tigo / Yas           → prefix 071, 065, 067
 *   - Halotel              → prefix 062
 *   - TTCL                 → prefix 073
 *
 * Flow: POST /azampay/mno/checkout → AzamPay triggers USSD push on customer's phone
 *       → Customer enters PIN → AzamPay POSTs callback to our /api/payments/tz/azampay
 */
class AzamPayGateway implements PaymentGatewayInterface
{
    /**
     * Mobile number prefix → AzamPay provider name mapping.
     * AzamPay requires exact provider strings (case-sensitive).
     */
    private const PROVIDER_MAP = [
        // Vodacom / M-Pesa TZ
        '0740' => 'Mpesa', '0741' => 'Mpesa', '0742' => 'Mpesa',
        '0743' => 'Mpesa', '0744' => 'Mpesa', '0745' => 'Mpesa',
        '0746' => 'Mpesa', '0747' => 'Mpesa', '0748' => 'Mpesa',
        '0749' => 'Mpesa', '0750' => 'Mpesa', '0751' => 'Mpesa',
        '0752' => 'Mpesa', '0753' => 'Mpesa', '0754' => 'Mpesa',
        '0755' => 'Mpesa', '0756' => 'Mpesa', '0757' => 'Mpesa',
        '0758' => 'Mpesa', '0759' => 'Mpesa', '0760' => 'Mpesa',
        '0761' => 'Mpesa', '0762' => 'Mpesa', '0763' => 'Mpesa',
        '0764' => 'Mpesa', '0765' => 'Mpesa', '0766' => 'Mpesa',
        '0767' => 'Mpesa', '0768' => 'Mpesa', '0769' => 'Mpesa',

        // Airtel Tanzania
        '0780' => 'Airtel', '0781' => 'Airtel', '0782' => 'Airtel',
        '0783' => 'Airtel', '0784' => 'Airtel', '0785' => 'Airtel',
        '0786' => 'Airtel', '0787' => 'Airtel', '0788' => 'Airtel',
        '0689' => 'Airtel', '0680' => 'Airtel', '0681' => 'Airtel',
        '0682' => 'Airtel', '0683' => 'Airtel', '0684' => 'Airtel',
        '0685' => 'Airtel', '0686' => 'Airtel', '0687' => 'Airtel',
        '0688' => 'Airtel', '0690' => 'Airtel', '0691' => 'Airtel',
        '0692' => 'Airtel', '0693' => 'Airtel', '0694' => 'Airtel',
        '0695' => 'Airtel', '0696' => 'Airtel', '0697' => 'Airtel',
        '0698' => 'Airtel', '0699' => 'Airtel',

        // Tigo / Yas
        '0710' => 'Tigo', '0711' => 'Tigo', '0712' => 'Tigo',
        '0713' => 'Tigo', '0714' => 'Tigo', '0715' => 'Tigo',
        '0716' => 'Tigo', '0717' => 'Tigo', '0718' => 'Tigo',
        '0719' => 'Tigo', '0650' => 'Tigo', '0651' => 'Tigo',
        '0652' => 'Tigo', '0653' => 'Tigo', '0654' => 'Tigo',
        '0655' => 'Tigo', '0670' => 'Tigo', '0671' => 'Tigo',
        '0672' => 'Tigo', '0673' => 'Tigo', '0674' => 'Tigo',
        '0675' => 'Tigo', '0676' => 'Tigo', '0677' => 'Tigo',
        '0678' => 'Tigo', '0679' => 'Tigo',

        // Halotel
        '0620' => 'Halopesa', '0621' => 'Halopesa', '0622' => 'Halopesa',
        '0623' => 'Halopesa', '0624' => 'Halopesa', '0625' => 'Halopesa',
        '0626' => 'Halopesa', '0627' => 'Halopesa', '0628' => 'Halopesa',
        '0629' => 'Halopesa',

        // TTCL Pesa
        '0730' => 'TTCL', '0731' => 'TTCL', '0732' => 'TTCL',
    ];

    public function __construct(
        private readonly AzamPayTokenService $tokenService,
        private readonly string $checkoutBaseUrl,
        private readonly string $apiKey, // AZAMPAY_TOKEN = X-API-Key static header
    ) {}

    /**
     * Trigger MNO USSD push via AzamPay.
     * The customer receives a prompt on their phone to enter their mobile money PIN.
     */
    public function initiate(Order $order, array $payload): PaymentResult
    {
        $phone        = $payload['payment_number'];          // E.g. "+255767692816"
        $msisdn       = $this->toMsisdnFormat($phone);      // "255767692816"
        $provider     = $this->detectProvider($phone);      // Detect from original or standardized input
        $externalId   = $order->transaction_ref;             // Our "TXN-XXXXXXXX"

        Log::info('AzamPay: Initiating MNO checkout', [
            'order_id'   => $order->id,
            'provider'   => $provider,
            'phone'      => $msisdn,
            'amount'     => (string) intval($order->total_paid),
            'externalId' => $externalId,
        ]);

        try {
            $token    = $this->tokenService->getToken();
            $response = Http::timeout(30)
                ->withToken($token)
                ->withHeaders(['X-API-Key' => $this->apiKey])
                ->post("{$this->checkoutBaseUrl}/azampay/mno/checkout", [
                    'accountNumber' => (string) $msisdn,
                    'amount'        => (int) $order->total_paid,
                    'currency'      => 'TZS',
                    'externalId'    => (string) $externalId,
                    'provider'      => (string) $provider,
                    'additionalProperties' => [
                        'key' => new \stdClass(),
                    ],
                ]);

            $data = $response->json() ?? [];

            Log::info('AzamPay: MNO checkout response', [
                'order_id' => $order->id,
                'status'   => $response->status(),
                'body'     => $data,
            ]);

            if ($response->successful() && ($data['success'] ?? false)) {
                return PaymentResult::success(
                    message: $data['message'] ?? 'Ombi limetumwa. Angalia simu yako na ingiza PIN yako kukamilisha malipo.',
                    gatewayRef: $data['transactionId'] ?? $data['referenceId'] ?? null,
                    raw: $data,
                );
            }

            // Handle 401 — token may have expired mid-session
            if ($response->status() === 401) {
                Log::warning('AzamPay: 401 received, refreshing token and retrying.');
                $token    = $this->tokenService->refreshToken();
                $response = Http::timeout(30)
                    ->withToken($token)
                    ->withHeaders(['X-API-Key' => $this->apiKey])
                    ->post("{$this->checkoutBaseUrl}/azampay/mno/checkout", [
                        'accountNumber' => $msisdn,
                        'amount'        => (string) intval($order->total_paid),
                        'currency'      => 'TZS',
                        'externalId'    => $externalId,
                        'provider'      => $provider,
                    ]);

                $data = $response->json() ?? [];

                if ($response->successful() && ($data['success'] ?? false)) {
                    return PaymentResult::success(
                        message: $data['message'] ?? 'Angalia simu yako na ingiza PIN.',
                        gatewayRef: $data['transactionId'] ?? $data['referenceId'] ?? null,
                        raw: $data,
                    );
                }
            }

            return PaymentResult::failure(
                message: $data['message'] ?? 'Imeshindwa kuanzisha malipo. Jaribu tena.',
                errorCode: (string) $response->status(),
                raw: $data,
            );

        } catch (\Throwable $e) {
            Log::error('AzamPay: initiate() threw an exception', [
                'order_id' => $order->id,
                'error'    => $e->getMessage(),
            ]);

            return PaymentResult::failure(
                message: 'Hitilafu ya mtandao. Jaribu tena baadaye.',
                errorCode: 'network_error',
            );
        }
    }

    public function getName(): string
    {
        return 'azampay';
    }

    public function getSupportedCountries(): array
    {
        return ['TZ'];
    }

    /**
     * Convert international/local format to full MSISDN format.
     * "+255784123456" -> "255784123456"
     * "0784123456"    -> "255784123456"
     */
    private function toMsisdnFormat(string $phone): string
    {
        $phone = preg_replace('/[\s\-\(\)\+]/', '', $phone);

        if (str_starts_with($phone, '0')) {
            return '255' . substr($phone, 1);
        }

        if (!str_starts_with($phone, '255')) {
            return '255' . $phone;
        }

        return $phone;
    }

    /**
     * Detect the mobile network provider from a local TZ phone number.
     * Falls back to 'Airtel' if prefix is unrecognised.
     */
    private function detectProvider(string $phone): string
    {
        // Standardize to local format for prefix check
        $phone = preg_replace('/[\s\-\(\)\+]/', '', $phone);
        if (str_starts_with($phone, '255')) {
            $localPhone = '0' . substr($phone, 3);
        } elseif (str_starts_with($phone, '0')) {
            $localPhone = $phone;
        } else {
            $localPhone = '0' . $phone;
        }

        $prefix4 = substr($localPhone, 0, 4);

        if (isset(self::PROVIDER_MAP[$prefix4])) {
            return self::PROVIDER_MAP[$prefix4];
        }

        // Try 3-digit prefix as fallback (e.g. 078x, 075x)
        $prefix3 = substr($localPhone, 0, 3);
        $byPrefix3 = collect(self::PROVIDER_MAP)
            ->filter(fn($_, $k) => str_starts_with($k, $prefix3))
            ->first();

        if ($byPrefix3) {
            return $byPrefix3;
        }

        Log::warning("AzamPay: Unknown provider for phone prefix [{$localPhone}], defaulting to Airtel.");
        return 'Airtel';
    }
}
