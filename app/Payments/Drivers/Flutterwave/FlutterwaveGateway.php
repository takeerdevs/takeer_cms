<?php

namespace App\Payments\Drivers\Flutterwave;

use App\Models\Order;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\PaymentResult;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FlutterwaveGateway implements PaymentGatewayInterface
{
    private string $secretKey;
    private string $baseUrl;

    public function __construct()
    {
        $this->secretKey = config('services.flutterwave.secret_key');
        $this->baseUrl   = config('services.flutterwave.base_url', 'https://api.flutterwave.com/v3');
    }

    /**
     * Initiate a Mobile Money payment in Tanzania.
     */
    public function initiate(Order $order, array $payload): PaymentResult
    {
        $phone = $payload['payment_number'] ?? $order->buyer->phone_number;
        $phone = ltrim($phone, '+');

        try {
            // Using v3 charges API
            $response = Http::withToken($this->secretKey)
                ->timeout(15)
                ->post("{$this->baseUrl}/charges?type=mobile_money_tanzania", [
                    'amount'       => (float) $order->total_paid,
                    'currency'     => 'TZS',
                    'email'        => $order->buyer->email ?? "guest_{$order->buyer_id}@takeer.com",
                    'tx_ref'       => $order->transaction_ref,
                    'phone_number' => $phone,
                    'fullname'     => $payload['buyer_name'] ?? $order->buyer->name,
                    'meta' => [
                        'order_id' => $order->id,
                    ],
                ]);

            $data = $response->json();

            if ($response->successful() && (($data['status'] ?? '') === 'success')) {
                return PaymentResult::success(
                    message: "Ombi la malipo limetumwa kwenye simu yako. Tafadhali weka PIN kukamilisha.",
                    gatewayRef: (string)($data['data']['id'] ?? ''),
                    raw: $data
                );
            }

            return PaymentResult::failure(
                message: $data['message'] ?? 'Imeshindwa kuanzisha malipo ya Flutterwave.',
                errorCode: (string)($data['error_code'] ?? 'FLW_INIT_ERROR'),
                raw: $data
            );

        } catch (\Exception $e) {
            Log::error('FlutterwaveGateway: Exception during initiation.', [
                'order_id' => $order->id,
                'error'    => $e->getMessage()
            ]);

            return PaymentResult::failure(
                message: 'Hitilafu imetokea wakati wa kuwasiliana na mtoa huduma wa malipo.',
                errorCode: 'GATEWAY_CONNECTION_ERROR'
            );
        }
    }

    public function getName(): string
    {
        return 'flutterwave';
    }

    public function getSupportedCountries(): array
    {
        return ['TZ', 'NG', 'KE', 'UG', 'GH'];
    }
}
