<?php

namespace App\Services\Fiscal;

class FiscalProviderResult
{
    public function __construct(
        public readonly bool $successful,
        public readonly string $status,
        public readonly ?string $receiptNumber = null,
        public readonly ?string $verificationCode = null,
        public readonly ?string $verificationUrl = null,
        public readonly ?string $qrCodeData = null,
        public readonly ?string $zReportReference = null,
        public readonly array $providerResponse = [],
        public readonly ?string $failureReason = null,
        public readonly bool $fallbackToManual = false,
    ) {
    }
}
