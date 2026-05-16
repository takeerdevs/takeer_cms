<?php

namespace App\Services\Fiscal;

use App\Models\FiscalReceipt;
use App\Models\MerchantFiscalIntegration;

class PendingProviderAdapter implements FiscalReceiptProvider
{
    public function issue(MerchantFiscalIntegration $integration, FiscalReceipt $receipt): FiscalProviderResult
    {
        return new FiscalProviderResult(
            successful: false,
            status: 'provider_pending',
            providerResponse: [
                'provider' => $integration->provider?->code,
                'message' => 'Provider API adapter is not configured yet.',
            ],
            failureReason: 'Provider API adapter is pending official API credentials/docs.',
            fallbackToManual: true
        );
    }
}
