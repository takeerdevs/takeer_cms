<?php

namespace App\Services\SocialCommerce;

use App\Services\LinkPreviewService;

class FacebookMarketplaceSocialCommerceProvider extends AbstractSocialCommerceProvider
{
    public function __construct(private readonly LinkPreviewService $linkPreview) {}

    protected function platform(): string { return 'facebook_marketplace'; }
    protected function hosts(): array { return ['facebook.com', 'm.facebook.com', 'web.facebook.com']; }

    protected function pathParts(string $path): ?array
    {
        if (preg_match('#^/(?:[a-z]{2}(?:_[A-Z]{2})?/)?marketplace/item/([0-9]+)/?$#', $path, $matches)) {
            return ['external_post_id' => $matches[1]];
        }

        if (preg_match('#^/share/([A-Za-z0-9_-]{4,80})/?$#', $path, $matches)) {
            return ['external_post_id' => 'share:' . $matches[1]];
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
