<?php

namespace App\Services;

use App\Models\LinkPreview;
use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class LinkPreviewService
{
    private const MAX_IMAGE_BYTES = 5_242_880;
    private const PREVIEW_TTL_DAYS = 14;
    private const FAILURE_TTL_HOURS = 12;

    public function previewForText(?string $text): ?LinkPreview
    {
        $url = $this->firstUrl($text);

        return $url ? $this->previewForUrl($url) : null;
    }

    public function previewForUrl(string $rawUrl): ?LinkPreview
    {
        $url = $this->normalizeUrl($rawUrl);
        if (! $url || ! $this->isSafePublicUrl($url)) {
            return null;
        }
        $urlHash = hash('sha256', $url);
        $embed = $this->detectEmbed($url);

        $existing = LinkPreview::query()
            ->where('url_hash', $urlHash)
            ->where('expires_at', '>', now())
            ->first();

        if ($existing) {
            return $existing;
        }

        $preview = LinkPreview::query()->firstOrNew(['url_hash' => $urlHash]);
        $preview->fill([
            'url' => $url,
            'status' => 'pending',
            'fetched_at' => now(),
            'expires_at' => now()->addHours(self::FAILURE_TTL_HOURS),
        ])->save();

        try {
            if ($embed) {
                $embedMetadata = $this->fetchEmbedMetadata($url, $embed);
                if ($embedMetadata) {
                    $localImageUrl = $embedMetadata['remote_image_url']
                        ? $this->storePreviewImage($embedMetadata['remote_image_url'])
                        : null;

                    $preview->fill([
                        'final_url' => $url,
                        'title' => $embedMetadata['title'],
                        'description' => $embedMetadata['description'],
                        'site_name' => $embedMetadata['site_name'],
                        'favicon_url' => null,
                        'remote_image_url' => $embedMetadata['remote_image_url'],
                        'image_url' => $localImageUrl,
                        'status' => 'success',
                        'embed_provider' => $embed['provider'],
                        'embed_type' => $embed['type'],
                        'embed_url' => $embed['embed_url'],
                        'external_id' => $embed['external_id'],
                        'fetched_at' => now(),
                        'expires_at' => now()->addDays(self::PREVIEW_TTL_DAYS),
                    ])->save();

                    return $preview;
                }
            }

            $response = Http::timeout(8)
                ->connectTimeout(3)
                ->withUserAgent('TakeerBot/1.0 (+https://takeer.local)')
                ->withHeaders([
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->withOptions([
                    'allow_redirects' => ['max' => 3, 'strict' => true],
                ])
                ->get($url);

            $finalUrl = (string) ($response->handlerStats()['url'] ?? $url);
            $contentType = strtolower((string) $response->header('Content-Type', ''));
            $html = (string) $response->body();

            if (! $response->successful() || $this->isCloudflareChallenge($html)) {
                $solved = $this->resolveWithFlareSolverr($url);
                if (! $solved) {
                    return $this->markUnavailable($preview, $url, $finalUrl);
                }

                $finalUrl = $solved['final_url'] ?: $finalUrl;
                $contentType = 'text/html';
                $html = $solved['html'];
            }

            if (! $this->isSafePublicUrl($finalUrl)) {
                return $this->markUnavailable($preview, $url, $finalUrl);
            }

            if ($contentType && ! str_contains($contentType, 'text/html') && ! str_contains($contentType, 'application/xhtml')) {
                return $this->markUnavailable($preview, $url, $finalUrl);
            }

            if ($html === '') {
                return $this->markUnavailable($preview, $url, $finalUrl);
            }

            $metadata = $this->extractMetadata($html, $finalUrl);
            if (! $metadata['title'] && ! $metadata['description'] && ! $metadata['remote_image_url']) {
                return $this->markUnavailable($preview, $url, $finalUrl);
            }

            $localImageUrl = $metadata['remote_image_url']
                ? $this->storePreviewImage($metadata['remote_image_url'])
                : null;

            $preview->fill([
                'final_url' => $finalUrl,
                'title' => $metadata['title'],
                'description' => $metadata['description'],
                'site_name' => $metadata['site_name'] ?: $this->hostLabel($finalUrl),
                'favicon_url' => $metadata['favicon_url'],
                'remote_image_url' => $metadata['remote_image_url'],
                'image_url' => $localImageUrl,
                'status' => 'success',
                'embed_provider' => $embed['provider'] ?? null,
                'embed_type' => $embed['type'] ?? null,
                'embed_url' => $embed['embed_url'] ?? null,
                'external_id' => $embed['external_id'] ?? null,
                'fetched_at' => now(),
                'expires_at' => now()->addDays(self::PREVIEW_TTL_DAYS),
            ])->save();

            return $preview;
        } catch (Throwable $e) {
            Log::warning('Link preview fetch failed', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            return $this->markUnavailable($preview, $url);
        }
    }

    private function firstUrl(?string $text): ?string
    {
        if (! $text) {
            return null;
        }

        preg_match('/\b((?:https?:\/\/|www\.)[^\s<>"\']+)/i', $text, $matches);

        return isset($matches[1])
            ? rtrim($matches[1], ".,!?;:)]}")
            : null;
    }

    private function normalizeUrl(string $rawUrl): ?string
    {
        $url = trim($rawUrl);
        if ($url === '') {
            return null;
        }

        if (str_starts_with(strtolower($url), 'www.')) {
            $url = 'https://' . $url;
        }

        $parts = parse_url($url);
        if (! is_array($parts) || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return null;
        }

        $url = Str::before($url, '#');

        return filter_var($url, FILTER_VALIDATE_URL) ? $url : null;
    }

    private function detectEmbed(string $url): ?array
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host);
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $youtubeId = null;
        if (in_array($host, ['youtube.com', 'm.youtube.com', 'music.youtube.com'], true)) {
            if (! empty($query['v']) && is_string($query['v'])) {
                $youtubeId = $query['v'];
            } elseif (preg_match('#^(shorts|embed)/([^/?]+)#i', $path, $matches)) {
                $youtubeId = $matches[2];
            }
        } elseif ($host === 'youtu.be' && $path !== '') {
            $youtubeId = explode('/', $path)[0] ?? null;
        }

        if ($youtubeId && preg_match('/^[A-Za-z0-9_-]{6,32}$/', $youtubeId)) {
            return [
                'provider' => 'youtube',
                'type' => 'video',
                'embed_url' => 'https://www.youtube.com/embed/' . $youtubeId,
                'external_id' => $youtubeId,
            ];
        }

        $vimeoId = null;
        if (in_array($host, ['vimeo.com', 'player.vimeo.com'], true)) {
            if (preg_match('#(?:video/)?([0-9]{6,14})#', $path, $matches)) {
                $vimeoId = $matches[1];
            }
        }

        if ($vimeoId) {
            return [
                'provider' => 'vimeo',
                'type' => 'video',
                'embed_url' => 'https://player.vimeo.com/video/' . $vimeoId,
                'external_id' => $vimeoId,
            ];
        }

        return null;
    }

    private function fetchEmbedMetadata(string $url, array $embed): ?array
    {
        $endpoint = match ($embed['provider'] ?? null) {
            'youtube' => 'https://www.youtube.com/oembed',
            'vimeo' => 'https://vimeo.com/api/oembed.json',
            default => null,
        };

        if (! $endpoint) {
            return null;
        }

        try {
            $response = Http::timeout(8)
                ->connectTimeout(3)
                ->acceptJson()
                ->get($endpoint, [
                    'url' => $url,
                    'format' => 'json',
                ]);

            if (! $response->successful()) {
                return null;
            }

            $payload = $response->json();
            $title = trim((string) ($payload['title'] ?? ''));
            $thumbnailUrl = trim((string) ($payload['thumbnail_url'] ?? ''));

            if ($title === '' && $thumbnailUrl === '') {
                return null;
            }

            return [
                'title' => Str::limit($title, 240, ''),
                'description' => trim((string) ($payload['author_name'] ?? '')),
                'site_name' => $embed['provider'] === 'youtube' ? 'YouTube' : 'Vimeo',
                'remote_image_url' => $thumbnailUrl !== '' ? $thumbnailUrl : null,
            ];
        } catch (Throwable $e) {
            Log::warning('Embed metadata fetch failed', [
                'url' => $url,
                'provider' => $embed['provider'] ?? null,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function extractMetadata(string $html, string $baseUrl): array
    {
        $previous = libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $dom->loadHTML($html, LIBXML_NOWARNING | LIBXML_NOERROR | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($dom);
        $meta = function (array $names) use ($xpath): ?string {
            foreach ($names as $name) {
                $query = sprintf(
                    '//meta[translate(@property, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="%1$s" or translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="%1$s"]/@content',
                    strtolower($name)
                );
                $value = trim((string) $xpath->evaluate('string(' . $query . ')'));
                if ($value !== '') {
                    return html_entity_decode($value, ENT_QUOTES | ENT_HTML5);
                }
            }

            return null;
        };

        $title = $meta(['og:title', 'twitter:title'])
            ?: trim((string) $xpath->evaluate('string(//title)'));

        $favicon = trim((string) $xpath->evaluate('string(//link[contains(translate(@rel, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "icon")]/@href)'));

        return [
            'title' => Str::limit($title ?: '', 240, ''),
            'description' => Str::limit($meta(['og:description', 'twitter:description', 'description']) ?: '', 500, ''),
            'site_name' => Str::limit($meta(['og:site_name']) ?: '', 160, ''),
            'remote_image_url' => $this->absoluteUrl($meta(['og:image:secure_url', 'og:image', 'twitter:image']), $baseUrl),
            'favicon_url' => $this->absoluteUrl($favicon ?: null, $baseUrl),
        ];
    }

    private function storePreviewImage(string $imageUrl): ?string
    {
        if (! $this->isSafePublicUrl($imageUrl)) {
            return null;
        }

        try {
            $response = Http::timeout(8)
                ->connectTimeout(3)
                ->withUserAgent('TakeerBot/1.0 (+https://takeer.local)')
                ->withHeaders(['Accept' => 'image/avif,image/webp,image/png,image/jpeg,image/gif'])
                ->withOptions(['allow_redirects' => ['max' => 3, 'strict' => true]])
                ->get($imageUrl);

            if (! $response->successful()) {
                return null;
            }

            $finalUrl = (string) ($response->handlerStats()['url'] ?? $imageUrl);
            if (! $this->isSafePublicUrl($finalUrl)) {
                return null;
            }

            $contentType = strtolower((string) $response->header('Content-Type', ''));
            $extension = match (true) {
                str_contains($contentType, 'jpeg'), str_contains($contentType, 'jpg') => 'jpg',
                str_contains($contentType, 'png') => 'png',
                str_contains($contentType, 'webp') => 'webp',
                str_contains($contentType, 'gif') => 'gif',
                str_contains($contentType, 'avif') => 'avif',
                default => null,
            };

            $body = $response->body();
            if (! $extension || strlen($body) > self::MAX_IMAGE_BYTES) {
                return null;
            }

            $path = 'link-previews/' . now()->format('Y/m') . '/' . Str::random(40) . '.' . $extension;
            Storage::disk('public')->put($path, $body);

            return Storage::disk('public')->url($path);
        } catch (Throwable $e) {
            Log::warning('Link preview image fetch failed', [
                'url' => $imageUrl,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function resolveWithFlareSolverr(string $url): ?array
    {
        $endpoint = rtrim((string) config('services.flaresolverr.url'), '/');
        if ($endpoint === '') {
            return null;
        }

        try {
            $response = Http::timeout(max(10, (int) ceil(config('services.flaresolverr.timeout', 15000) / 1000) + 5))
                ->post($endpoint . '/v1', [
                    'cmd' => 'request.get',
                    'url' => $url,
                    'maxTimeout' => (int) config('services.flaresolverr.timeout', 15000),
                ]);

            if (! $response->successful()) {
                return null;
            }

            $payload = $response->json();
            if (($payload['status'] ?? null) !== 'ok') {
                return null;
            }

            $solution = $payload['solution'] ?? [];
            $html = (string) ($solution['response'] ?? '');
            if ($html === '' || $this->isCloudflareChallenge($html)) {
                return null;
            }

            return [
                'html' => $html,
                'final_url' => (string) ($solution['url'] ?? $url),
            ];
        } catch (Throwable $e) {
            Log::warning('FlareSolverr link preview fetch failed', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function isCloudflareChallenge(string $html): bool
    {
        $head = strtolower(substr($html, 0, 8000));

        return str_contains($head, '<title>just a moment')
            || str_contains($head, 'cf-browser-verification')
            || str_contains($head, 'cf-challenge')
            || str_contains($head, 'cdn-cgi/challenge-platform');
    }

    private function absoluteUrl(?string $url, string $baseUrl): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        if (str_starts_with($url, '//')) {
            $scheme = parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https';
            return $scheme . ':' . $url;
        }

        if (filter_var($url, FILTER_VALIDATE_URL)) {
            return $url;
        }

        $base = parse_url($baseUrl);
        if (! is_array($base) || empty($base['scheme']) || empty($base['host'])) {
            return null;
        }

        $origin = $base['scheme'] . '://' . $base['host'] . (isset($base['port']) ? ':' . $base['port'] : '');
        if (str_starts_with($url, '/')) {
            return $origin . $url;
        }

        $dir = isset($base['path']) ? rtrim(Str::beforeLast($base['path'], '/'), '/') : '';

        return $origin . ($dir ? '/' . ltrim($dir, '/') : '') . '/' . ltrim($url, '/');
    }

    private function isSafePublicUrl(string $url): bool
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return false;
        }

        if (in_array($host, ['localhost', '0.0.0.0'], true) || str_ends_with($host, '.local')) {
            return false;
        }

        $ips = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if ($ips === []) {
            return false;
        }

        foreach ($ips as $ip) {
            if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return false;
            }
        }

        return true;
    }

    private function markUnavailable(LinkPreview $preview, string $url, ?string $finalUrl = null): LinkPreview
    {
        $preview->fill([
            'final_url' => $finalUrl ?: $url,
            'title' => $this->titleFromUrl($finalUrl ?: $url),
            'description' => null,
            'site_name' => $this->hostLabel($finalUrl ?: $url),
            'status' => 'fallback',
            'embed_provider' => null,
            'embed_type' => null,
            'embed_url' => null,
            'external_id' => null,
            'fetched_at' => now(),
            'expires_at' => now()->addHours(self::FAILURE_TTL_HOURS),
        ])->save();

        return $preview;
    }

    private function titleFromUrl(string $url): ?string
    {
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        if ($path === '') {
            return $this->hostLabel($url);
        }

        $last = Str::beforeLast(basename($path), '.');
        $last = preg_replace('/-[a-f0-9]{8,}$/i', '', $last) ?: $last;
        $title = str_replace(['-', '_'], ' ', $last);
        $title = trim(preg_replace('/\s+/', ' ', $title));

        return $title !== ''
            ? Str::limit(Str::headline($title), 120, '')
            : $this->hostLabel($url);
    }

    private function hostLabel(string $url): ?string
    {
        $host = parse_url($url, PHP_URL_HOST);

        return $host ? preg_replace('/^www\./i', '', $host) : null;
    }
}
