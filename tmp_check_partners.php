<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Payments\Drivers\AzamPay\AzamPayTokenService;
use Illuminate\Support\Facades\Http;

$tokenService = app(AzamPayTokenService::class);
$token = $tokenService->getToken();
$apiKey = config('services.azampay.token');

$response = Http::withToken($token)
    ->withHeaders(['X-API-Key' => $apiKey])
    ->get('https://sandbox.azampay.co.tz/api/v1/Partner/GetPaymentPartners');

echo "Status: " . $response->status() . "\n";
echo "Body: " . $response->body() . "\n";
