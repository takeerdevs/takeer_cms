<?php

namespace App\Payments;

final class PaymentEvent
{
    public function __construct(
        public readonly string $provider,
        public readonly string $direction,
        public readonly string $status,
        public readonly ?string $providerReference = null,
        public readonly ?string $takeerReference = null,
        public readonly ?string $channelKey = null,
        public readonly ?float $amount = null,
        public readonly ?string $currency = null,
        public readonly ?string $network = null,
        public readonly ?array $rawPayload = null,
        public readonly ?string $failureReason = null,
    ) {}

    public function isSuccessful(): bool
    {
        return in_array($this->status, ['success', 'successful', 'paid', 'completed'], true);
    }

    public function isFailed(): bool
    {
        return in_array($this->status, ['failed', 'cancelled', 'rejected', 'expired'], true);
    }
}
