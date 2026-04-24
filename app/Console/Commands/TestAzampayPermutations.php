<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use App\Payments\Drivers\AzamPay\AzamPayTokenService;
use Illuminate\Support\Str;

class TestAzampayPermutations extends Command
{
    protected $signature = 'test:azampay {phone}';
    protected $description = 'Test AzamPay MNO checkout with different permutations';

    public function handle(AzamPayTokenService $tokenService)
    {
        $phone = $this->argument('phone'); 
        $baseUrl = config('services.azampay.checkout_base_url');
        $apiKey = config('services.azampay.token');
        
        $token = $tokenService->getToken();
        
        $providers = ['Mpesa', 'Tigo', 'Airtel', 'Halopesa'];
        $amounts = ["1500", "1"];
        $phones = [
            $phone,
            '0700000000', // Standard AzamPay sandbox test number
        ];

        foreach ($phones as $p) {
            foreach ($providers as $provider) {
                foreach ($amounts as $amount) {
                    $fmtPhone = '255' . ltrim(preg_replace('/^\+255/', '', $p), '0');
                    
                    // Try with and without X-API-Key
                    foreach ([true, false] as $useApiKey) {
                        $this->info("Testing Provider: {$provider} | Phone: {$fmtPhone} | Amount: {$amount} | X-API-Key: " . ($useApiKey ? 'Yes' : 'No'));
                        
                        try {
                            $headers = ['Content-Type' => 'application/json'];
                            if ($useApiKey) {
                                $headers['X-API-Key'] = $apiKey;
                            }

                            $response = Http::timeout(10)
                                ->withToken($token)
                                ->withHeaders($headers)
                                ->post("{$baseUrl}/azampay/mno/checkout", [
                                    'accountNumber' => (string)$fmtPhone,
                                    'amount'        => (int)$amount,
                                    'currency'      => 'TZS',
                                    'externalId'    => (string)time() . rand(100, 999), // Purely numeric string
                                    'provider'      => $provider,
                                    'additionalProperties' => [
                                        'key' => new \stdClass()
                                    ]
                                ]);

                            $data = $response->json();
                            if ($response->successful() && ($data['success'] ?? false)) {
                                $this->warn("✅ SUCCESS with Provider: {$provider}, Phone: {$fmtPhone}, Amount: {$amount}, X-API-Key: " . ($useApiKey ? 'Yes' : 'No'));
                                return;
                            } else {
                                $this->error("❌ Failed: Provider: {$provider} | " . ($data['message'] ?? 'Unknown error') . " (Code: " . ($data['messageCode'] ?? 'none') . ")");
                            }
                        } catch (\Exception $e) {
                            $this->error("💥 Exception: " . $e->getMessage());
                        }
                    }
                }
            }
        }
    }
}
