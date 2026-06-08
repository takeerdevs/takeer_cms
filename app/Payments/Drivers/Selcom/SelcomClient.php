<?php

namespace App\Payments\Drivers\Selcom;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SelcomClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly string $apiSecret,
        private readonly int $timeout = 30,
    ) {
    }

    public function post(string $path, array $payload, array $signedFields): Response
    {
        return Http::timeout($this->timeout)
            ->withHeaders($this->headers($payload, $signedFields))
            ->post($this->url($path), $payload);
    }

    public function get(string $path, array $query, array $signedFields): Response
    {
        return Http::timeout($this->timeout)
            ->withHeaders($this->headers($query, $signedFields))
            ->get($this->url($path), $query);
    }

    public function enabled(): bool
    {
        return $this->baseUrl !== '' && $this->apiKey !== '' && $this->apiSecret !== '';
    }

    private function headers(array $payload, array $signedFields): array
    {
        $timestamp = now(config('app.timezone', 'UTC'))->toIso8601String();
        $fields = collect($signedFields)
            ->map(fn ($field) => trim((string) $field))
            ->filter()
            ->values()
            ->all();

        return [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'Authorization' => 'SELCOM ' . base64_encode($this->apiKey),
            'Digest-Method' => 'HS256',
            'Digest' => $this->digest($payload, $fields, $timestamp),
            'Timestamp' => $timestamp,
            'Signed-Fields' => implode(',', $fields),
        ];
    }

    private function digest(array $payload, array $signedFields, string $timestamp): string
    {
        $parts = ["timestamp={$timestamp}"];

        foreach ($signedFields as $field) {
            $value = data_get($payload, $field, '');
            if (is_array($value)) {
                $value = json_encode($value, JSON_UNESCAPED_SLASHES);
            }

            $parts[] = "{$field}={$value}";
        }

        $signingString = implode('&', $parts);

        return base64_encode(hash_hmac('sha256', $signingString, $this->apiSecret, true));
    }

    private function url(string $path): string
    {
        return rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/');
    }

    public static function cleanReference(string $value, string $prefix = 'SEL'): string
    {
        $clean = preg_replace('/[^A-Za-z0-9]/', '', $value);

        return Str::limit($clean !== '' ? $clean : $prefix . Str::random(12), 30, '');
    }
}
