<?php

namespace App\Services\Fiscal;

use App\Models\FiscalReceipt;
use App\Models\MerchantFiscalIntegration;

interface FiscalReceiptProvider
{
    public function issue(MerchantFiscalIntegration $integration, FiscalReceipt $receipt): FiscalProviderResult;
}
