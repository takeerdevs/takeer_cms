<?php

namespace Tests\Unit;

use App\Payments\Drivers\AzamPay\AzamPayGateway;
use App\Payments\GatewayRegistry;
use Tests\TestCase;

class GatewayRegistryTest extends TestCase
{
    public function test_azampay_is_the_primary_tanzania_gateway(): void
    {
        $gateway = app(GatewayRegistry::class)->resolveForCountry('TZ');

        $this->assertInstanceOf(AzamPayGateway::class, $gateway);
        $this->assertSame('azampay', $gateway->getName());
    }

    public function test_tanzania_gateway_can_be_switched_without_code_changes(): void
    {
        config()->set('payment_gateways.TZ', [
            [
                'driver' => 'azampay',
                'priority' => 1,
                'enabled' => false,
                'label' => 'AzamPay',
            ],
            [
                'driver' => 'flutterwave',
                'priority' => 2,
                'enabled' => true,
                'label' => 'Flutterwave',
            ],
        ]);

        $gateway = app(GatewayRegistry::class)->resolveForCountry('TZ');

        $this->assertSame('flutterwave', $gateway->getName());
    }
}
