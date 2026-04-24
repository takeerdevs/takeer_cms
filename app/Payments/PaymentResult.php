<?php

namespace App\Payments;

/**
 * Immutable DTO returned by every gateway's initiate() call.
 * Keeps the CheckoutController free of gateway-specific response parsing.
 */
final class PaymentResult
{
    private function __construct(
        public readonly bool   $success,
        public readonly string $message,
        public readonly ?string $gatewayRef,    // Gateway's own transaction/reference ID
        public readonly array  $raw = [],       // Full raw response for logging/debugging
        public readonly ?string $errorCode = null,
    ) {}

    public static function success(
        string $message,
        ?string $gatewayRef = null,
        array $raw = []
    ): self {
        return new self(
            success: true,
            message: $message,
            gatewayRef: $gatewayRef,
            raw: $raw,
        );
    }

    public static function failure(
        string $message,
        ?string $errorCode = null,
        array $raw = []
    ): self {
        return new self(
            success: false,
            message: $message,
            gatewayRef: null,
            raw: $raw,
            errorCode: $errorCode,
        );
    }
}
