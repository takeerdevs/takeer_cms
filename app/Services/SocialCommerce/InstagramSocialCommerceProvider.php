<?php

namespace App\Services\SocialCommerce;

use App\Services\LinkPreviewService;

class InstagramSocialCommerceProvider extends AbstractSocialCommerceProvider
{
    public function __construct(private readonly LinkPreviewService $linkPreview) {}

    protected function platform(): string { return 'instagram'; }
    protected function hosts(): array { return ['instagram.com', 'm.instagram.com']; }

    protected function pathParts(string $path): ?array
    {
        if (preg_match('#^/(?:p|reel)/([A-Za-z0-9_-]+)/?$#', $path, $matches)) {
            return ['external_post_id' => $matches[1]];
        }

        return null;
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
}
