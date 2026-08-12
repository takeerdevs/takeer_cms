<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Payments\Drivers\AzamPay\AzamPayGateway;
use App\Payments\Drivers\AzamPay\AzamPayTokenService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AzamPayGatewayTest extends TestCase
{
    public function test_it_uses_the_sandbox_mno_checkout_contract_for_a_tanzanian_number(): void
    {
        Cache::forget('azampay:bearer_token');

        Http::fake([
            'https://authenticator-sandbox.azampay.co.tz/AppRegistration/GenerateToken' => Http::response([
                'data' => ['accessToken' => 'sandbox-bearer-token'],
                'success' => true,
            ]),
            'https://sandbox.azampay.co.tz/azampay/mno/checkout' => Http::response([
                'success' => true,
                'transactionId' => 'AZAM-SANDBOX-123',
                'message' => 'Request accepted',
            ]),
        ]);

        $tokenService = new AzamPayTokenService(
            authenticatorBaseUrl: 'https://authenticator-sandbox.azampay.co.tz',
            clientId: 'sandbox-client',
            clientSecret: 'sandbox-secret',
            appName: 'Takeer',
        );

        $gateway = new AzamPayGateway(
            tokenService: $tokenService,
            checkoutBaseUrl: 'https://sandbox.azampay.co.tz',
            apiKey: 'sandbox-api-key',
        );

        $order = new Order([
            'transaction_ref' => 'TXN-AZAMPAY01',
            'total_paid' => 2500,
            'customer_total_amount' => 2500,
            'customer_currency_code' => 'TZS',
        ]);
        $order->id = 123;

        $result = $gateway->initiate($order, ['payment_number' => '+255754123456']);

        $this->assertTrue($result->success);
        $this->assertSame('AZAM-SANDBOX-123', $result->gatewayRef);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://sandbox.azampay.co.tz/azampay/mno/checkout'
                && $request->hasHeader('Authorization', 'Bearer sandbox-bearer-token')
                && $request->hasHeader('X-API-Key', 'sandbox-api-key')
                && $request['accountNumber'] === '255754123456'
                && $request['amount'] === 2500
                && $request['currency'] === 'TZS'
                && $request['externalId'] === 'TXN-AZAMPAY01'
                && $request['provider'] === 'Mpesa';
        });
    }
}
