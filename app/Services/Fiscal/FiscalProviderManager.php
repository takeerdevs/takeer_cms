<?php

namespace App\Services\Fiscal;

use App\Models\FiscalProvider;

class FiscalProviderManager
{
    public function forProvider(FiscalProvider $provider): FiscalReceiptProvider
    {
        return new PendingProviderAdapter();
    }
}
