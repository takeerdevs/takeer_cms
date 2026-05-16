<?php

namespace App\Services;

use App\Models\TrackedLink;
use Illuminate\Support\Str;

class TrackedLinkService
{
    public function trackedUrlFor(?string $rawUrl, array $context = []): ?string
    {
        $link = $this->trackedLinkFor($rawUrl, $context);

        return $link ? route('tracked-links.follow', $link->code) : null;
    }

    public function trackedLinkFor(?string $rawUrl, array $context = []): ?TrackedLink
    {
        $url = $this->normalizeHttpUrl($rawUrl);
        if (! $url || $this->isInternalUrl($url)) {
            return null;
        }

        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $merchantId = isset($context['merchant_id']) ? (int) $context['merchant_id'] : null;
        $entityId = isset($context['entity_id']) ? (int) $context['entity_id'] : null;
        $linkType = $this->slugValue($context['link_type'] ?? 'outbound', 'outbound', 80);
        $sourceSurface = $this->nullableSlugValue($context['source_surface'] ?? null, 120);
        $entityType = $this->nullableSlugValue($context['entity_type'] ?? null, 80);
        $destinationHash = hash('sha256', implode('|', [
            $url,
            $merchantId ?: '',
            $linkType,
            $sourceSurface ?: '',
            $entityType ?: '',
            $entityId ?: '',
        ]));

        return TrackedLink::query()->firstOrCreate(
            [
                'merchant_id' => $merchantId,
                'destination_hash' => $destinationHash,
                'link_type' => $linkType,
                'source_surface' => $sourceSurface,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
            ],
            [
                'created_by' => isset($context['created_by']) ? (int) $context['created_by'] : null,
                'code' => $this->newCode(),
                'destination_url' => $url,
                'destination_host' => $host ?: null,
                'label' => $context['label'] ?? null,
                'status' => 'active',
                'metadata' => $context['metadata'] ?? [],
            ]
        );
    }

    public function normalizeHttpUrl(?string $rawUrl): ?string
    {
        $url = trim((string) $rawUrl);
        if ($url === '') {
            return null;
        }

        if (str_starts_with(strtolower($url), 'www.')) {
            $url = 'https://'.$url;
        }

        $parts = parse_url($url);
        if (! is_array($parts) || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return null;
        }

        $url = Str::before($url, '#');

        return filter_var($url, FILTER_VALIDATE_URL) ? $url : null;
    }

    public function isInternalUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $appHost = strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST));

        return $host !== '' && $appHost !== '' && $host === $appHost;
    }

    private function newCode(): string
    {
        do {
            $code = 'go_'.Str::lower(Str::random(14));
        } while (TrackedLink::query()->where('code', $code)->exists());

        return $code;
    }

    private function slugValue(mixed $value, string $fallback, int $limit): string
    {
        $normalized = $this->nullableSlugValue($value, $limit);

        return $normalized ?: $fallback;
    }

    private function nullableSlugValue(mixed $value, int $limit): ?string
    {
        $normalized = preg_replace('/[^a-zA-Z0-9_-]/', '_', trim((string) $value));
        $normalized = trim((string) $normalized, '_');

        return $normalized !== '' ? Str::limit($normalized, $limit, '') : null;
    }
}
