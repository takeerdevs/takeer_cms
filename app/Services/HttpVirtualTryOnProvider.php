<?php

namespace App\Services;

use App\Contracts\VirtualTryOnProvider;
use App\Models\ProductTryOnAsset;
use App\Models\TryOnSession;
use Illuminate\Support\Facades\Http;

class HttpVirtualTryOnProvider implements VirtualTryOnProvider
{
    public function __construct(private readonly TryOnStorageService $storage)
    {
    }

    public function generate(TryOnSession $session, ProductTryOnAsset $asset): TryOnProviderResult
    {
        $endpoint = trim((string) config('services.try_on.endpoint'));
        if ($endpoint === '') {
            throw new \RuntimeException('TRY_ON_ENDPOINT is not configured.');
        }

        $timeout = max(10, (int) config('services.try_on.timeout', 180));
        $portraitBytes = $this->storage->read($session->portrait_disk, $session->portrait_path);
        $garmentBytes = $this->storage->read($asset->disk, $asset->garment_path);
        $portraitMime = $session->portrait_mime ?: 'image/jpeg';
        $garmentMime = $asset->mime ?: 'image/png';
        $portraitField = (string) config('services.try_on.portrait_field', 'person_image');
        $garmentField = (string) config('services.try_on.garment_field', 'garment_image');

        $request = Http::timeout($timeout)
            ->acceptJson()
            ->attach($portraitField, $portraitBytes, 'portrait.'.($this->extensionForMime($portraitMime)), ['Content-Type' => $portraitMime])
            ->attach($garmentField, $garmentBytes, 'garment.'.($this->extensionForMime($garmentMime)), ['Content-Type' => $garmentMime]);

        $apiKey = trim((string) config('services.try_on.api_key'));
        if ($apiKey !== '') {
            $request = $request->withToken($apiKey);
        }

        $response = $request->post($endpoint, [
            'category' => data_get($asset->metadata ?: [], 'category', 'upper_body'),
            'variant_id' => $session->product_variant_id,
            'product_id' => $session->product_id,
        ]);

        $response->throw();
        $contentType = strtolower((string) $response->header('Content-Type', ''));

        if (str_starts_with($contentType, 'image/')) {
            return new TryOnProviderResult(
                contents: $response->body(),
                mimeType: $this->normalizeImageMime($contentType),
                metadata: ['mode' => 'http', 'response_type' => 'image'],
            );
        }

        $payload = $response->json();
        $base64Field = (string) config('services.try_on.response_base64_field', 'image_base64');
        $urlField = (string) config('services.try_on.response_url_field', 'image_url');
        $base64 = data_get($payload, $base64Field);
        $imageUrl = data_get($payload, $urlField);

        if (is_string($base64) && $base64 !== '') {
            [$mimeType, $contents] = $this->decodeBase64Image($base64);

            return new TryOnProviderResult(
                contents: $contents,
                mimeType: $mimeType,
                metadata: ['mode' => 'http', 'response_type' => 'base64'],
            );
        }

        if (is_string($imageUrl) && filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            $imageResponse = Http::timeout($timeout)->get($imageUrl);
            $imageResponse->throw();
            $mimeType = $this->normalizeImageMime((string) $imageResponse->header('Content-Type', 'image/jpeg'));

            return new TryOnProviderResult(
                contents: $imageResponse->body(),
                mimeType: $mimeType,
                metadata: ['mode' => 'http', 'response_type' => 'url'],
            );
        }

        throw new \RuntimeException('The try-on provider did not return an image.');
    }

    private function decodeBase64Image(string $value): array
    {
        $mimeType = 'image/jpeg';
        if (preg_match('/^data:(image\/[a-z0-9.+-]+);base64,/', $value, $matches)) {
            $mimeType = $this->normalizeImageMime($matches[1]);
            $value = substr($value, strpos($value, ',') + 1);
        }

        $contents = base64_decode($value, true);
        if ($contents === false || $contents === '') {
            throw new \RuntimeException('The try-on provider returned invalid base64 image data.');
        }

        return [$mimeType, $contents];
    }

    private function normalizeImageMime(string $mimeType): string
    {
        $mimeType = strtolower(trim(explode(';', $mimeType)[0]));

        return in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp'], true)
            ? $mimeType
            : 'image/jpeg';
    }

    private function extensionForMime(string $mimeType): string
    {
        return match ($this->normalizeImageMime($mimeType)) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };
    }
}
