<?php

namespace App\Contracts;

use App\Models\ProductTryOnAsset;
use App\Models\TryOnSession;
use App\Services\TryOnProviderResult;

interface VirtualTryOnProvider
{
    public function generate(TryOnSession $session, ProductTryOnAsset $asset): TryOnProviderResult;
}
