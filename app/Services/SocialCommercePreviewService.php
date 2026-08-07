<?php

namespace App\Services;

use App\Models\LinkPreview;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class SocialCommercePreviewService
{
    public function __construct(
        private readonly SocialCommerceProviderRegistry $registry,
        private readonly SocialCommerceContactExtractionService $contacts,
        private readonly SocialCommerceSellerSignalExtractionService $sellerSignals,
    ) {}

    public function preview(string $url, array $context = []): array
    {
        $provider = $this->registry->providerFor($url);
        $link = $provider->normalize($url);
        $result = $provider->preview($link, $context);
        $preview = $result['link_preview'] ?? null;
        $previewData = $result['preview'] ?? null;
        $link = $this->resolveFinalLink($link, $preview);
        $sellerIdentity = $this->sellerSignals->extract(
            is_array($previewData) ? $previewData : null,
            (string) ($link['platform'] ?? ''),
        );
        $link['external_seller_handle'] = $sellerIdentity['handle'];
        $link['external_seller_profile_url'] = $sellerIdentity['profile_url'];
        $contactCandidates = $this->contacts->extract(
            is_array($previewData) ? implode("\n", array_filter([
                $previewData['title'] ?? null,
                $previewData['description'] ?? null,
                $previewData['site_name'] ?? null,
            ])) : null,
            $context['phone_region'] ?? null,
        );

        if ($preview instanceof LinkPreview) {
            $preview->forceFill([
                'preview_provenance' => $result['provenance'] ?? 'unavailable',
                'failure_reason' => $result['failure_reason'] ?? null,
                'external_platform' => $link['platform'],
                'external_post_id' => $link['external_post_id'] ?? null,
            ])->save();
        }

        return [
            'link' => $link,
            'seller_identity' => $sellerIdentity,
            'status' => $result['status'] ?? 'unavailable',
            'provenance' => $result['provenance'] ?? 'unavailable',
            'preview' => is_array($previewData)
                ? [...$previewData, 'contact_candidates' => $contactCandidates]
                : null,
            'contact_candidates' => $contactCandidates,
            'failure_reason' => $result['failure_reason'] ?? null,
            'link_preview_id' => $preview?->id,
        ];
    }

    public function normalize(string $url): array
    {
        return $this->registry->normalize($url);
    }

    private function resolveFinalLink(array $link, ?LinkPreview $preview): array
    {
        $finalUrl = trim((string) $preview?->final_url);
        if ($finalUrl === '' || $finalUrl === $link['normalized_url']) {
            return $link;
        }

        try {
            $resolvedProvider = $this->registry->providerFor($finalUrl);
            $resolvedLink = $resolvedProvider->normalize($finalUrl);
            if (($resolvedLink['platform'] ?? null) !== ($link['platform'] ?? null)) {
                return $link;
            }

            $link['normalized_url'] = $resolvedLink['normalized_url'];
            $link['url_hash'] = $resolvedLink['url_hash'];
            $link['external_post_id'] = $resolvedLink['external_post_id'] ?? $link['external_post_id'] ?? null;
        } catch (InvalidArgumentException) {
            // A share URL may resolve to a login page or generic Facebook
            // surface. Keep the original share token and preview evidence.
        }

        return $link;
    }
}
