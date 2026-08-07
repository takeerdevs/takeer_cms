<?php

namespace App\Services;

class SocialCommerceSellerSignalExtractionService
{
    /**
     * Extract seller-account signals from metadata already returned by the
     * public link-preview fetcher. This deliberately does not fetch pages or
     * use browser automation.
     *
     * @return array{handle:?string,profile_url:?string,source:?string,confidence:?string,matched_by:?string,candidates:array<int,array{handle:string,source:string}>}
     */
    public function extract(?array $preview, string $platform): array
    {
        $text = implode("\n", array_filter([
            $preview['title'] ?? null,
            $preview['description'] ?? null,
            $preview['site_name'] ?? null,
        ], static fn ($value): bool => is_string($value) && trim($value) !== ''));

        $candidates = [];
        $this->addCandidates($candidates, $this->extractProfileHandles($text, $platform), 'profile_url');
        $this->addCandidates($candidates, $this->extractExplicitHandles($text), 'explicit_handle');
        $this->addCandidates($candidates, $this->extractInstagramCaptionHandles($text, $platform), 'caption_metadata');

        $candidateList = array_values(array_map(
            static fn (array $candidate): array => [
                'handle' => $candidate['handle'],
                'source' => $candidate['source'],
            ],
            $candidates,
        ));

        $selected = null;
        if (count($candidateList) === 1) {
            $selected = $candidateList[0];
        } elseif ($candidateList !== []) {
            $profileCandidate = collect($candidateList)->firstWhere('source', 'profile_url');
            $selected = $profileCandidate ?: null;
        }

        $handle = $selected['handle'] ?? null;
        $matchedBy = $selected['source'] ?? null;

        return [
            'handle' => $handle,
            'profile_url' => $handle
                ? ($platform === 'instagram'
                    ? 'https://www.instagram.com/' . $handle . '/'
                    : ($platform === 'facebook_marketplace' ? 'https://www.facebook.com/' . $handle . '/' : null))
                : null,
            'source' => $handle ? 'public_metadata' : null,
            'confidence' => $handle
                ? ($matchedBy === 'profile_url' || $matchedBy === 'explicit_handle' ? 'high' : 'medium')
                : null,
            'matched_by' => $matchedBy,
            'candidates' => $candidateList,
        ];
    }

    /** @param array<string,array{handle:string,source:string}> $candidates */
    private function addCandidates(array &$candidates, array $handles, string $source): void
    {
        foreach ($handles as $rawHandle) {
            $handle = $this->normalizeHandle($rawHandle);
            if ($handle === null) {
                continue;
            }

            if (!isset($candidates[$handle]) || $this->sourcePriority($source) < $this->sourcePriority($candidates[$handle]['source'])) {
                $candidates[$handle] = ['handle' => $handle, 'source' => $source];
            }
        }
    }

    /** @return string[] */
    private function extractProfileHandles(string $text, string $platform): array
    {
        $pattern = match ($platform) {
            'instagram' => '~(?:https?://)?(?:www\.)?instagram\.com/(?!p(?:/|$)|reel(?:/|$)|reels(?:/|$)|accounts(?:/|$)|about(?:/|$)|direct(?:/|$)|explore(?:/|$)|stories(?:/|$)|privacy(?:/|$)|terms(?:/|$)|developer(?:/|$)|static(?:/|$)|web(?:/|$))([A-Za-z0-9._]{1,30})(?:[/?#]|$)~i',
            'facebook_marketplace' => '~(?:https?://)?(?:www\.|web\.|m\.)?facebook\.com/(?!marketplace(?:/|$)|share(?:/|$)|profile\.php(?:[?#]|$)|groups?(?:/|$)|pages?(?:/|$)|watch(?:/|$)|reels?(?:/|$)|posts?(?:/|$)|photo(?:/|$)|events?(?:/|$)|login(?:/|$)|help(?:/|$)|settings?(?:/|$)|messages?(?:/|$)|friends?(?:/|$)|home(?:/|$)|gaming(?:/|$)|public(?:/|$)|hashtag(?:/|$)|search(?:/|$)|stories(?:/|$)|permalink(?:/|$)|video(?:/|$)|plugins?(?:/|$))([A-Za-z0-9.]{3,100})(?:[/?#]|$)~i',
            default => null,
        };
        if ($pattern === null) {
            return [];
        }

        preg_match_all($pattern, $text, $matches);

        return $matches[1] ?? [];
    }

    /** @return string[] */
    private function extractExplicitHandles(string $text): array
    {
        preg_match_all('/(?<![A-Za-z0-9_@])@([A-Za-z0-9._]{1,30})(?![A-Za-z0-9_])/i', $text, $matches);

        return $matches[1] ?? [];
    }

    /** @return string[] */
    private function extractInstagramCaptionHandles(string $text, string $platform): array
    {
        if ($platform !== 'instagram') {
            return [];
        }

        $months = 'January|February|March|April|May|June|July|August|September|October|November|December';
        preg_match_all(
            '/(?:^|\bcomments?\s*[-–—]|[-–—])\s*([A-Za-z0-9._]{1,30})\s+on\s+(?:' . $months . ')\s+\d{1,2},\s+\d{4}/i',
            $text,
            $matches,
        );

        return $matches[1] ?? [];
    }

    private function normalizeHandle(string $handle): ?string
    {
        $handle = strtolower(ltrim(trim($handle), '@'));
        if ($handle === '' || strlen($handle) > 30 || !preg_match('/^[a-z0-9._]+$/', $handle)) {
            return null;
        }

        return in_array($handle, [
            'p', 'reel', 'reels', 'accounts', 'about', 'direct', 'explore', 'stories',
            'privacy', 'terms', 'developer', 'static', 'web', 'legal',
            'marketplace', 'share', 'profile.php', 'groups', 'pages', 'watch', 'reels',
            'posts', 'photo', 'events', 'login', 'help', 'settings', 'messages', 'friends',
            'home', 'gaming', 'public', 'hashtag', 'search', 'stories', 'permalink', 'video',
            'plugins',
        ], true) ? null : $handle;
    }

    private function sourcePriority(string $source): int
    {
        return match ($source) {
            'profile_url' => 1,
            'explicit_handle' => 2,
            'caption_metadata' => 3,
            default => 9,
        };
    }
}
