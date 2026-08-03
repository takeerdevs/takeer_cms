<?php

namespace App\Payments\Drivers\Selcom;

use App\Models\Order;
use App\Payments\Contracts\PaymentGatewayInterface;
use App\Payments\Contracts\PaymentProviderAdapterInterface;
use App\Payments\PaymentEvent;
use App\Payments\PaymentResult;
use App\Services\PaymentDisplayDirectory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SelcomGateway implements PaymentGatewayInterface, PaymentProviderAdapterInterface
{
    private const WALLET_PAYIN_PATH = '/v1/checkout/wallet-payment';
    private const CREATE_ORDER_MINIMAL_PATH = '/v1/checkout/create-order-minimal';
    private const CHECKOUT_ORDER_STATUS_PATH = '/v1/checkout/order-status';
    private const QWIKSEND_PROCESS_PATH = '/v1/qwiksend/process';
    private const QWIKSEND_QUERY_PATH = '/v1/qwiksend/query';
    private const WALLET_CASHIN_PROCESS_PATH = '/v1/walletcashin/process';
    private const WALLET_CASHIN_QUERY_PATH = '/v1/walletcashin/query';
    private const VENDOR_BALANCE_PATH = '/v1/vendor/balance';

    public function __construct(
        private readonly SelcomClient $client,
        private readonly PaymentDisplayDirectory $displayDirectory,
        private readonly string $vendor,
        private readonly string $callbackUrl,
        private readonly bool $simulate = false,
    ) {
    }

    public function initiate(Order $order, array $payload): PaymentResult
    {
        return $this->createPayin([
            'takeer_reference' => $order->transaction_ref,
            'order_id' => $payload['selcom_order_id'] ?? $order->transaction_ref,
            'amount' => (float) ($order->customer_total_amount ?? $order->total_paid),
            'currency' => $order->customer_currency_code ?: 'TZS',
            'msisdn' => $payload['payment_number'] ?? $order->payment_phone,
            'buyer_email' => $order->buyer?->email,
            'buyer_name' => $order->buyer?->name,
            'buyer_phone' => $order->buyer?->phone_number ?: $order->account_phone,
            'webhook' => url('/api/payments/selcom/payin-callback'),
        ]);
    }

    public function createPayin(array $payload): PaymentResult
    {
        if ($this->simulate) {
            if (app()->environment('production')) {
                return PaymentResult::failure('Payment simulation is disabled in production.', 'simulation_disabled');
            }
            return $this->simulatedResult('payin', $payload);
        }

        if (! $this->client->enabled()) {
            return PaymentResult::failure('Selcom credentials are not configured.', 'selcom_not_configured');
        }

        $transId = SelcomClient::cleanReference((string) ($payload['takeer_reference'] ?? uniqid('pay', true)), 'PAY');
        $orderId = SelcomClient::cleanReference((string) ($payload['order_id'] ?? $transId), 'ORD');
        $orderResult = $this->createMinimalOrder($payload, $orderId);
        if (! $orderResult->success) {
            return $orderResult;
        }

        $body = [
            'transid' => $transId,
            'order_id' => $orderId,
            'msisdn' => $this->msisdn((string) ($payload['msisdn'] ?? '')),
        ];

        try {
            $response = $this->client->post(self::WALLET_PAYIN_PATH, $body, ['transid', 'order_id', 'msisdn']);
            $data = $response->json() ?: [];

            if ($response->successful() && $this->isAccepted($data)) {
                return PaymentResult::success(
                    $data['message'] ?? 'Selcom payment request sent. Ask the customer to approve it on their phone.',
                    $data['reference'] ?? $transId,
                    $data + ['takeer_reference' => $transId],
                );
            }

            return PaymentResult::failure(
                $data['message'] ?? 'Selcom could not start the payment request.',
                (string) ($data['resultcode'] ?? $response->status()),
                $data,
            );
        } catch (\Throwable $e) {
            Log::error('Selcom pay-in request failed.', [
                'error' => $e->getMessage(),
                'takeer_reference' => $transId,
                'payload_fields' => array_keys($body),
            ]);

            return PaymentResult::failure('Selcom payment request failed.', 'selcom_network_error');
        }
    }

    public function queryVendorBalance(): PaymentResult
    {
        if ($this->simulate) {
            return PaymentResult::success('Selcom simulation: vendor balance unavailable from provider.', 'SIM-SELCOM-BALANCE', [
                'simulated' => true,
                'provider' => 'selcom',
                'resultcode' => '111',
                'result' => 'PENDING',
                'balance' => null,
                'message' => 'Simulation mode is enabled. Provider balance status is unavailable in simulation.',
            ]);
        }

        if (! $this->client->enabled()) {
            return PaymentResult::failure('Selcom credentials are not configured.', 'selcom_not_configured');
        }

        $transId = SelcomClient::cleanReference('BAL' . now()->format('YmdHis'), 'BAL');
        $body = [
            'vendor' => $this->vendor,
            'pin' => (string) config('services.selcom.vendor_pin', ''),
            'transid' => $transId,
        ];

        $response = $this->client->post(self::VENDOR_BALANCE_PATH, $body, array_keys($body));
        $data = $response->json() ?: [];

        if ($response->successful() && $this->isAccepted($data)) {
            return PaymentResult::success(
                $data['message'] ?? 'Selcom vendor balance returned.',
                $data['reference'] ?? $transId,
                $data + ['takeer_reference' => $transId],
            );
        }

        return PaymentResult::failure(
            $data['message'] ?? 'Selcom vendor balance query failed.',
            (string) ($data['resultcode'] ?? $response->status()),
            $data + ['takeer_reference' => $transId],
        );
    }

    private function createMinimalOrder(array $payload, string $orderId): PaymentResult
    {
        $webhook = (string) ($payload['webhook'] ?? url('/api/payments/selcom/payin-callback'));
        $body = [
            'vendor' => $this->vendor,
            'order_id' => $orderId,
            'buyer_email' => (string) ($payload['buyer_email'] ?? ''),
            'buyer_name' => (string) ($payload['buyer_name'] ?? 'Takeer Customer'),
            'buyer_phone' => $this->msisdn((string) ($payload['buyer_phone'] ?? $payload['msisdn'] ?? '')),
            'amount' => $this->amount($payload['amount'] ?? 0),
            'currency' => strtoupper((string) ($payload['currency'] ?? 'TZS')),
            'payment_methods' => 'MOBILEMONEY',
            'webhook' => base64_encode($webhook),
            'buyer_remarks' => (string) ($payload['buyer_remarks'] ?? 'Takeer checkout'),
            'merchant_remarks' => (string) ($payload['merchant_remarks'] ?? 'Takeer checkout'),
        ];

        $signedFields = [
            'vendor',
            'order_id',
            'buyer_email',
            'buyer_name',
            'buyer_phone',
            'amount',
            'currency',
            'payment_methods',
            'webhook',
            'buyer_remarks',
            'merchant_remarks',
        ];

        $response = $this->client->post(self::CREATE_ORDER_MINIMAL_PATH, $body, $signedFields);
        $data = $response->json() ?: [];

        return $this->paymentResultFromResponse($response->status(), $data, $orderId, 'Selcom checkout order created.');
    }

    public function createPayout(array $payload): PaymentResult
    {
        if ($this->simulate) {
            if (app()->environment('production')) {
                return PaymentResult::failure('Payout simulation is disabled in production.', 'simulation_disabled');
            }
            return $this->simulatedResult('payout', $payload);
        }

        if (! $this->client->enabled()) {
            return PaymentResult::failure('Selcom credentials are not configured.', 'selcom_not_configured');
        }

        $method = (string) ($payload['method'] ?? 'mobile_money');

        return $method === 'bank'
            ? $this->createBankPayout($payload)
            : $this->createMobileMoneyPayout($payload);
    }

    public function createRefund(array $payload): PaymentResult
    {
        return PaymentResult::failure(
            'Selcom refund submission is not enabled until the PSP refund contract is configured.',
            'refund_adapter_not_certified',
        );
    }

    public function queryRefundStatus(string $providerReference): PaymentEvent
    {
        return new PaymentEvent(
            provider: $this->key(),
            direction: 'refund',
            status: 'pending',
            providerReference: $providerReference,
            takeerReference: $providerReference,
            failureReason: 'Refund status query is not configured for this PSP adapter.',
        );
    }

    public function verifyCallback(Request $request): bool
    {
        $secret = (string) config('services.selcom.callback_secret');
        if ($secret === '') {
            return false;
        }

        $signature = trim((string) ($request->header('X-Selcom-Signature') ?: $request->header('Digest')));
        if ($signature === '') {
            return false;
        }

        $timestamp = trim((string) ($request->header('X-Selcom-Timestamp') ?: $request->header('Timestamp')));
        if ($timestamp !== '' && is_numeric($timestamp) && abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $raw = $request->getContent();
        $candidates = [
            hash_hmac('sha256', $raw, $secret),
            base64_encode(hash_hmac('sha256', $raw, $secret, true)),
        ];

        $signedFields = array_filter(array_map('trim', explode(',', (string) $request->header('Signed-Fields'))));
        if ($signedFields) {
            $parts = $timestamp !== '' ? ["timestamp={$timestamp}"] : [];
            $payload = $request->all();
            foreach ($signedFields as $field) {
                $value = data_get($payload, $field, '');
                $parts[] = $field . '=' . (is_array($value) ? json_encode($value, JSON_UNESCAPED_SLASHES) : $value);
            }
            $signingString = implode('&', $parts);
            $candidates[] = base64_encode(hash_hmac('sha256', $signingString, $secret, true));
            $candidates[] = hash_hmac('sha256', $signingString, $secret);
        }

        $signature = preg_replace('/^sha256=/i', '', $signature);
        foreach ($candidates as $candidate) {
            if (hash_equals($candidate, $signature)) {
                return true;
            }
        }

        return false;
    }

    public function verifyRawCallback(Request $request): bool
    {
        return $this->verifyCallback($request);
    }

    public function parseCallback(Request $request): PaymentEvent
    {
        $payload = $request->all();
        $direction = $request->routeIs('payments.selcom.payout-callback')
            ? 'payout'
            : ($request->routeIs('payments.selcom.refund-callback') ? 'refund' : (isset($payload['messageId']) ? 'payout' : 'payin'));

        return new PaymentEvent(
            provider: $this->key(),
            direction: $direction,
            status: $this->normalizeStatus((string) ($payload['payment_status'] ?? $payload['result'] ?? 'PENDING'), (string) ($payload['resultcode'] ?? '')),
            providerReference: $payload['reference'] ?? $payload['transid'] ?? null,
            takeerReference: $payload['order_id'] ?? $payload['utilityref'] ?? $payload['transid'] ?? $payload['messageId'] ?? null,
            channelKey: null,
            amount: isset($payload['amount']) ? (float) $payload['amount'] : null,
            currency: $payload['currency'] ?? null,
            network: $payload['operator'] ?? $payload['channel'] ?? null,
            rawPayload: $payload,
            failureReason: $payload['message'] ?? null,
        );
    }

    public function parseVerifiedCallback(Request $request): PaymentEvent
    {
        return $this->parseCallback($request);
    }

    public function queryStatus(string $providerReference): PaymentEvent
    {
        if ($event = $this->nonLiveQueryEvent('payout', $providerReference)) {
            return $event;
        }

        $response = $this->client->get(self::QWIKSEND_QUERY_PATH, ['transid' => $providerReference], ['transid']);
        $payload = $response->json() ?: [];

        return new PaymentEvent(
            provider: $this->key(),
            direction: 'payout',
            status: $this->normalizeStatus((string) ($payload['result'] ?? 'PENDING'), (string) ($payload['resultcode'] ?? '')),
            providerReference: $payload['reference'] ?? $providerReference,
            takeerReference: $payload['transid'] ?? $providerReference,
            rawPayload: $payload,
            failureReason: $payload['message'] ?? null,
        );
    }

    public function queryWalletCashinStatus(string $transId): PaymentEvent
    {
        if ($event = $this->nonLiveQueryEvent('payout', $transId)) {
            return $event;
        }

        $response = $this->client->get(self::WALLET_CASHIN_QUERY_PATH, ['transid' => $transId], ['transid']);
        $payload = $response->json() ?: [];

        return new PaymentEvent(
            provider: $this->key(),
            direction: 'payout',
            status: $this->normalizeStatus((string) ($payload['result'] ?? 'PENDING'), (string) ($payload['resultcode'] ?? '')),
            providerReference: $payload['reference'] ?? $transId,
            takeerReference: $payload['transid'] ?? $transId,
            rawPayload: $payload,
            failureReason: $payload['message'] ?? null,
        );
    }

    public function queryCheckoutOrderStatus(string $orderId): PaymentEvent
    {
        if ($event = $this->nonLiveQueryEvent('payin', $orderId)) {
            return $event;
        }

        $response = $this->client->get(self::CHECKOUT_ORDER_STATUS_PATH, ['order_id' => $orderId], ['order_id']);
        $payload = $response->json() ?: [];
        $data = data_get($payload, 'data.0', []);

        return new PaymentEvent(
            provider: $this->key(),
            direction: 'payin',
            status: $this->normalizeStatus((string) (data_get($data, 'payment_status') ?? $payload['payment_status'] ?? $payload['result'] ?? 'PENDING'), (string) ($payload['resultcode'] ?? '')),
            providerReference: data_get($data, 'reference') ?? data_get($data, 'transid') ?? $payload['reference'] ?? $orderId,
            takeerReference: data_get($data, 'order_id') ?? $payload['order_id'] ?? $orderId,
            amount: isset($data['amount']) ? (float) $data['amount'] : null,
            currency: data_get($data, 'currency') ?? $payload['currency'] ?? null,
            network: data_get($data, 'channel') ?? $payload['channel'] ?? null,
            rawPayload: $payload,
            failureReason: $payload['message'] ?? null,
        );
    }

    public function key(): string
    {
        return 'selcom';
    }

    public function getName(): string
    {
        return $this->key();
    }

    public function getSupportedCountries(): array
    {
        return ['TZ'];
    }

    private function createBankPayout(array $payload): PaymentResult
    {
        $transId = SelcomClient::cleanReference((string) ($payload['takeer_reference'] ?? uniqid('bank', true)), 'BANK');
        $body = [
            'transid' => $transId,
            'recipientFiCode' => $this->displayDirectory->providerCodeForBank((string) data_get($payload, 'details.bank_code')),
            'recipientAccount' => (string) data_get($payload, 'details.account_number'),
            'recipientName' => (string) data_get($payload, 'details.account_name'),
            'senderAccount' => (string) config('services.selcom.sender_account', $this->vendor),
            'senderName' => (string) config('services.selcom.sender_name', config('app.name', 'Takeer')),
            'amount' => $this->amount($payload['amount'] ?? 0),
            'vendor' => $this->vendor,
            'pin' => (string) config('services.selcom.vendor_pin', ''),
            'msisdn' => $this->msisdn((string) config('services.selcom.sender_msisdn', '')),
            'purpose' => (string) ($payload['purpose'] ?? 'BUSINESS'),
            'currency' => strtoupper((string) ($payload['currency'] ?? 'TZS')),
            'remarks' => (string) ($payload['narration'] ?? 'Takeer merchant payout'),
        ];

        $body = array_filter($body, fn ($value) => $value !== '');
        $response = $this->client->post(self::QWIKSEND_PROCESS_PATH, $body, array_keys($body));
        $data = $response->json() ?: [];

        return $this->paymentResultFromResponse($response->status(), $data, $transId, 'Selcom bank payout submitted.');
    }

    private function createMobileMoneyPayout(array $payload): PaymentResult
    {
        $transId = SelcomClient::cleanReference((string) ($payload['takeer_reference'] ?? uniqid('mob', true)), 'MOB');
        $body = [
            'transid' => $transId,
            'utilitycode' => $this->displayDirectory->cashinUtilityCodeForNetwork((string) (data_get($payload, 'details.network') ?: $payload['network'] ?? '')),
            'utilityref' => $this->msisdn((string) data_get($payload, 'details.phone_number')),
            'amount' => $this->amount($payload['amount'] ?? 0),
            'vendor' => $this->vendor,
            'pin' => (string) config('services.selcom.vendor_pin', ''),
            'msisdn' => $this->msisdn((string) config('services.selcom.sender_msisdn', '')),
        ];

        $body = array_filter($body, fn ($value) => $value !== '');
        $response = $this->client->post(self::WALLET_CASHIN_PROCESS_PATH, $body, array_keys($body));
        $data = $response->json() ?: [];

        return $this->paymentResultFromResponse($response->status(), $data, $transId, 'Selcom mobile money payout submitted.');
    }

    private function paymentResultFromResponse(int $status, array $data, string $fallbackRef, string $defaultMessage): PaymentResult
    {
        if ($status >= 200 && $status < 300 && $this->isAccepted($data)) {
            return PaymentResult::success(
                $data['message'] ?? $defaultMessage,
                $data['reference'] ?? $data['transid'] ?? $data['messageId'] ?? $fallbackRef,
                $data + ['takeer_reference' => $fallbackRef],
            );
        }

        return PaymentResult::failure(
            $data['message'] ?? 'Selcom rejected the request.',
            (string) ($data['resultcode'] ?? $status),
            $data + ['takeer_reference' => $fallbackRef],
        );
    }

    private function isAccepted(array $data): bool
    {
        $code = (string) ($data['resultcode'] ?? '');
        $result = strtoupper((string) ($data['result'] ?? $data['payment_status'] ?? ''));

        return in_array($code, ['000', '111', '001', '002', '003', '999'], true)
            || in_array($result, ['SUCCESS', 'PENDING', 'INPROGRESS', 'AMBIGOUS', 'AMBIGUOUS'], true);
    }

    private function normalizeStatus(string $status, string $code = ''): string
    {
        $status = strtoupper($status);

        if ($code === '000' || in_array($status, ['SUCCESS', 'COMPLETED', 'PAID'], true)) {
            return 'success';
        }

        if (in_array($code, ['111', '001', '002', '003', '999'], true) || in_array($status, ['PENDING', 'INPROGRESS', 'AMBIGOUS', 'AMBIGUOUS'], true)) {
            return 'pending';
        }

        return 'failed';
    }

    private function msisdn(string $phone): string
    {
        $phone = preg_replace('/[\s\-\(\)\+]/', '', $phone);
        if (str_starts_with($phone, '0')) {
            return '255' . substr($phone, 1);
        }

        return str_starts_with($phone, '255') ? $phone : '255' . $phone;
    }

    private function operator(string $network): string
    {
        return $this->displayDirectory->providerCodeForNetwork($network);
    }

    private function amount(mixed $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }

    private function simulatedResult(string $direction, array $payload): PaymentResult
    {
        $reference = 'SIM-SELCOM-' . strtoupper(substr(md5(json_encode($payload) . microtime(true)), 0, 12));

        return PaymentResult::success(
            $direction === 'payout'
                ? 'Selcom simulation: payout accepted for processing.'
                : 'Selcom simulation: payment request accepted.',
            $reference,
            [
                'simulated' => true,
                'provider' => 'selcom',
                'direction' => $direction,
                'reference' => $reference,
                'resultcode' => '111',
                'result' => 'PENDING',
                'message' => 'Simulated Selcom response. No real money moved.',
                'request' => $payload,
            ],
        );
    }

    private function nonLiveQueryEvent(string $direction, string $reference): ?PaymentEvent
    {
        if ($this->simulate) {
            return new PaymentEvent(
                provider: $this->key(),
                direction: $direction,
                status: 'pending',
                providerReference: $reference,
                takeerReference: $reference,
                rawPayload: [
                    'simulated' => true,
                    'provider' => 'selcom',
                    'direction' => $direction,
                    'reference' => $reference,
                    'resultcode' => '111',
                    'result' => 'PENDING',
                    'message' => 'Simulated Selcom status query.',
                ],
                failureReason: 'Selcom simulation mode is enabled.',
            );
        }

        if (! $this->client->enabled()) {
            return new PaymentEvent(
                provider: $this->key(),
                direction: $direction,
                status: 'pending',
                providerReference: $reference,
                takeerReference: $reference,
                rawPayload: [
                    'provider' => 'selcom',
                    'direction' => $direction,
                    'reference' => $reference,
                    'message' => 'Selcom credentials are not configured.',
                ],
                failureReason: 'Selcom credentials are not configured.',
            );
        }

        return null;
    }
}
