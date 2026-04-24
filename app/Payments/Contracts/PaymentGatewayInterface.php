<?php

namespace App\Payments\Contracts;

use App\Models\Order;
use App\Payments\PaymentResult;

/**
 * Every payment gateway driver (AzamPay, M-Pesa, Flutterwave, etc.)
 * must implement this interface. Keeps the CheckoutController decoupled
 * from any specific payment provider.
 */
interface PaymentGatewayInterface
{
    /**
     * Initiate a payment for the given order.
     * For mobile money: triggers a USSD push prompt on the customer's phone.
     * For card/redirect: returns a checkout URL.
     *
     * @param  Order  $order    The pending order to pay for.
     * @param  array  $payload  Extra request data (phone number, etc.).
     * @return PaymentResult
     */
    public function initiate(Order $order, array $payload): PaymentResult;

    /**
     * Human-readable gateway identifier, e.g. "azampay", "mpesa_tz", "flutterwave".
     * Used to store on orders and look up in the registry.
     */
    public function getName(): string;

    /**
     * ISO 3166-1 alpha-2 country code this driver operates in, e.g. "TZ", "KE".
     * A driver can return multiple countries if it supports cross-border.
     *
     * @return string[]
     */
    public function getSupportedCountries(): array;
}
