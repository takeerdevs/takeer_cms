<?php

namespace App\Services\SocialCommerce;

use App\Contracts\SocialCommerceProvider;
use Illuminate\Support\Str;

abstract class AbstractSocialCommerceProvider implements SocialCommerceProvider
{
    abstract protected function platform(): string;

    /** @return string[] */
    abstract protected function hosts(): array;

    abstract protected function pathParts(string $path): ?array;

    public function key(): string
    {
        return $this->platform();
    }

    public function supports(string $url): bool
    {
        $parts = parse_url($url);
        $host = strtolower((string) ($parts['host'] ?? ''));
        $host = preg_replace('/^www\./', '', $host);

        return in_array($host, $this->hosts(), true)
            && ($parts['scheme'] ?? null) === 'https'
            && $this->pathParts((string) ($parts['path'] ?? '')) !== null;
    }

    public function normalize(string $url): array
    {
        $parts = parse_url(trim($url));
        if (!is_array($parts) || !$this->supports($url)) {
            throw new \InvalidArgumentException('This social-media link is not supported.');
        }

        $path = '/' . trim((string) ($parts['path'] ?? ''), '/') . '/';
        $path = preg_replace('#/+#', '/', $path);
        $path = rtrim($path, '/') . '/';
        $query = [];
        parse_str((string) ($parts['query'] ?? ''), $query);
        foreach (array_keys($query) as $key) {
            if (Str::startsWith(strtolower((string) $key), ['utm_', 'fbclid', 'igsh', 'igshid', 'mibextid', 'ref'])) {
                unset($query[$key]);
            }
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        $host = preg_replace('/^www\./', '', $host);
        $normalizedHost = $this->platform() === 'facebook_marketplace' ? 'facebook.com' : 'instagram.com';
        $normalized = 'https://' . $normalizedHost . $path;
        if ($query !== []) {
            ksort($query);
            $normalized .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        }

        $parts = $this->pathParts($path);

        return [
            'platform' => $this->platform(),
            'normalized_url' => $normalized,
            'url_hash' => hash('sha256', $normalized),
            'external_post_id' => $parts['external_post_id'] ?? null,
            'external_seller_handle' => null,
        ];
    }

    public function matchConnectedMerchant(array $link, array $context = []): ?array
    {
        return null;
    }

    public function sellerContactOptions(array $link, array $context = []): array
    {
        return [
            'channels' => ['share_link', 'copy'],
            'official_messaging_available' => false,
            'suggested_phone' => null,
            'provenance' => 'unavailable',
        ];
    }
}
