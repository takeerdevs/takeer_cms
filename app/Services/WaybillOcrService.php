<?php

namespace App\Services;

use Illuminate\Support\Arr;

class WaybillOcrService
{
    public function __construct(private OpenRouterService $openRouterService)
    {
    }

    /**
     * Extract delivery metadata from a waybill/receipt image URL.
     * Returns a normalized payload safe for DB usage.
     */
    public function extractFromReceipt(string $receiptUrl): array
    {
        if ((bool) config('services.openrouter.simulate_ocr', true)) {
            return [
                'bus_company' => 'Tashriff',
                'waybill_tracking_number' => 'BUS-' . strtoupper(substr(md5($receiptUrl), 0, 8)),
                'confidence' => 0.93,
                'source' => 'simulated_openrouter',
                'raw_text' => 'TASHRIFF WAYBILL #BUS-12345',
            ];
        }

        $model = (string) config('services.openrouter.ocr_model', 'google/gemini-2.5-flash');

        $messages = [
            [
                'role' => 'system',
                'content' => 'You extract transport waybill metadata. Respond ONLY as strict JSON with keys: bus_company, waybill_tracking_number, confidence, raw_text.',
            ],
            [
                'role' => 'user',
                'content' => "Extract bus company and waybill tracking number from this image URL:\n{$receiptUrl}\nIf unsure, keep missing fields as empty string and set lower confidence.",
            ],
        ];

        $response = $this->openRouterService->chatCompletions($messages, $model);
        $content = Arr::get($response, 'choices.0.message.content', '');
        $parsed = $this->decodeJson($content);

        return [
            'bus_company' => trim((string) ($parsed['bus_company'] ?? '')),
            'waybill_tracking_number' => trim((string) ($parsed['waybill_tracking_number'] ?? '')),
            'confidence' => (float) ($parsed['confidence'] ?? 0),
            'source' => 'openrouter',
            'raw_text' => (string) ($parsed['raw_text'] ?? ''),
        ];
    }

    private function decodeJson(string $content): array
    {
        $decoded = json_decode($content, true);
        if (is_array($decoded)) return $decoded;

        if (preg_match('/\{.*\}/s', $content, $m)) {
            $decoded = json_decode($m[0], true);
            if (is_array($decoded)) return $decoded;
        }

        return [];
    }
}

