<?php

namespace App\Services\SocialCommerce;

use App\Contracts\SocialCommerceProvider;
use App\Services\LinkPreviewService;
use Illuminate\Support\Str;
use InvalidArgumentException;

class GenericWebSocialCommerceProvider implements SocialCommerceProvider
{
    public function __construct(private readonly LinkPreviewService $linkPreview) {}

    public function key(): string
    {
        return 'web';
    }

    public function supports(string $url): bool
    {
        $parts = parse_url(trim($url));

        return is_array($parts)
            && in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            && filled($parts['host'] ?? null);
    }

    public function normalize(string $url): array
    {
        $url = trim($url);
        if (!$this->supports($url)) {
            throw new InvalidArgumentException('Paste a valid public product link beginning with http:// or https://.');
        }

        $parts = parse_url($url);
        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower((string) $parts['host']);
        $port = isset($parts['port']) && !in_array([$scheme, (int) $parts['port']], [['http', 80], ['https', 443]], true)
            ? ':'.(int) $parts['port']
            : '';
        $path = (string) ($parts['path'] ?? '/');
        $path = $path === '' ? '/' : $path;
        $query = [];
        parse_str((string) ($parts['query'] ?? ''), $query);
        foreach (array_keys($query) as $key) {
            if (Str::startsWith(strtolower((string) $key), ['utm_', 'fbclid', 'igsh', 'igshid', 'mibextid', 'ref'])) {
                unset($query[$key]);
            }
        }
        ksort($query);

        $normalized = $scheme.'://'.$host.$port.$path;
        if ($query !== []) {
            $normalized .= '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986);
        }

        return [
            'platform' => 'web',
            'normalized_url' => $normalized,
            'url_hash' => hash('sha256', $normalized),
            'external_post_id' => null,
            'external_seller_handle' => null,
        ];
    }

    public function preview(array $link, array $context = []): array
    {
        $preview = $this->linkPreview->previewForUrl($link['normalized_url'], true);
        $status = $preview?->status === 'success' ? 'success' : 'unavailable';
        $imageUrl = $preview?->image_url ?: $preview?->remote_image_url;

        return [
            'status' => $status,
            'provenance' => $status === 'success' ? 'public_metadata' : 'unavailable',
            'preview' => $preview ? [
                'id' => $preview->id,
                'title' => $preview->title,
                'description' => $preview->description,
                'site_name' => $preview->site_name,
                'image_url' => $imageUrl,
            ] : null,
            'failure_reason' => $status === 'success' && !$imageUrl ? 'image_unavailable' : ($status === 'success' ? null : 'provider_unavailable'),
            'link_preview' => $preview,
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
