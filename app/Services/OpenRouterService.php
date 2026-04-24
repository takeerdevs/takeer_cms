<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class OpenRouterService
{
    private string $apiKey;
    private string $baseUrl = 'https://openrouter.ai/api/v1';

    public function __construct()
    {
        $this->apiKey = config('services.openrouter.api_key');
    }

    /**
     * Call any OpenRouter Model (e.g. google/gemini-2.5-flash)
     */
    public function chatCompletions(array $messages, string $model = 'google/gemini-2.5-flash'): array
    {
        if (empty($this->apiKey)) {
            throw new \Exception('OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your .env or Admin Settings.');
        }

        $response = Http::timeout(45)->withHeaders([
            'Authorization' => 'Bearer ' . $this->apiKey,
            'HTTP-Referer' => config('app.url'),
            'X-Title' => 'Takeer Social Commerce'
        ])->post("{$this->baseUrl}/chat/completions", [
                    'model' => $model,
                    'messages' => $messages,
                ]);

        if ($response->status() === 401) {
            throw new \Exception('OpenRouter API key ni batili (401 Unauthorized). Tafadhali angalia Admin Settings.');
        }

        if ($response->status() === 429) {
            throw new \Exception('Kikomo cha maombi kimefikiwa (429 Rate Limit). Jaribu tena baadaye.');
        }

        if ($response->failed()) {
            throw new \Exception('OpenRouter API imeshindwa (' . $response->status() . '): ' . $response->body());
        }

        $json = $response->json();
        if (empty($json['choices'][0]['message']['content'] ?? null)) {
            throw new \Exception('AI ilirudisha jibu tupu. Model: ' . $model);
        }

        return $json;
    }
}
