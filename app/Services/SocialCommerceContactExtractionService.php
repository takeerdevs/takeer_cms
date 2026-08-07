<?php

namespace App\Services;

use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberMatch;
use libphonenumber\PhoneNumberUtil;
use Throwable;

class SocialCommerceContactExtractionService
{
    private PhoneNumberUtil $phoneNumbers;

    public function __construct()
    {
        $this->phoneNumbers = PhoneNumberUtil::getInstance();
    }

    /**
     * Extract valid phone-number candidates from public social-post text.
     *
     * International numbers are parsed without a regional assumption. Local
     * numbers are parsed only when the caller supplies a two-letter region,
     * because a local number has no globally safe interpretation by itself.
     *
     * @return array<int, array<string, mixed>>
     */
    public function extract(?string $text, ?string $defaultRegion = null): array
    {
        $text = trim(html_entity_decode(strip_tags((string) $text), ENT_QUOTES | ENT_HTML5));
        if ($text === '') {
            return [];
        }

        $candidates = [];
        $this->collectMatches($candidates, $text, 'post_text', 'ZZ', 'high');

        $region = $this->normalizeRegion($defaultRegion);
        if ($region !== null) {
            $this->collectMatches($candidates, $text, 'post_text', $region, 'medium');
        }

        // Some sellers publish international numbers with an international
        // dial-out prefix (00) instead of a leading plus sign.
        preg_match_all('/(?<![\d+])00[1-9][\d\s().-]{6,24}\d(?!\d)/u', $text, $internationalMatches);
        foreach ($internationalMatches[0] ?? [] as $raw) {
            $normalized = $this->normalize('+' . ltrim(preg_replace('/\D+/', '', $raw), '0'), null);
            if ($normalized !== null) {
                $this->addCandidate($candidates, $normalized, $raw, 'post_text', 'high');
            }
        }

        // WhatsApp and tel links often contain the cleanest seller contact,
        // but may not be recognized by the general text matcher.
        preg_match_all('/(?:https?:\/\/)?(?:api\.whatsapp\.com\/send\?phone=|wa\.me\/|tel:)([+\d][\d\s().-]{6,24}\d)/iu', $text, $linkMatches);
        foreach ($linkMatches[1] ?? [] as $raw) {
            $linkValue = preg_match('/^(?:\+|00)/', trim($raw))
                ? $raw
                : '+' . preg_replace('/\D+/', '', $raw);
            $normalized = $this->normalize($linkValue, null);
            if ($normalized !== null) {
                $this->addCandidate($candidates, $normalized, $raw, 'contact_link', 'high');
            }
        }

        return array_values($candidates);
    }

    /**
     * Normalize one buyer-supplied or extracted value for SMS delivery.
     *
     * @return array<string, mixed>|null
     */
    public function normalize(?string $raw, ?string $defaultRegion = null): ?array
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return null;
        }

        $candidate = preg_replace('/[\x{00A0}\x{202F}]/u', ' ', $raw) ?: $raw;
        if (preg_match('/^00\s*/', $candidate)) {
            $candidate = '+' . ltrim(substr($candidate, 2), " \t");
        }

        $region = $this->normalizeRegion($defaultRegion) ?: 'ZZ';

        try {
            $number = $this->phoneNumbers->parse($candidate, $region);
            if (! $this->phoneNumbers->isValidNumber($number)) {
                return null;
            }

            return $this->normalizedPayload($number);
        } catch (Throwable) {
            return null;
        }
    }

    private function collectMatches(array &$candidates, string $text, string $source, string $region, string $confidence): void
    {
        try {
            foreach ($this->phoneNumbers->findNumbers($text, $region) as $match) {
                if (! $match instanceof PhoneNumberMatch) {
                    continue;
                }

                $number = $match->number();
                if (! $this->phoneNumbers->isValidNumber($number)) {
                    continue;
                }

                $this->addCandidate($candidates, $this->normalizedPayload($number), $match->rawString(), $source, $confidence);
            }
        } catch (Throwable) {
            // A malformed caption must never make the social-commerce preview fail.
        }
    }

    private function addCandidate(array &$candidates, array $normalized, string $raw, string $source, string $confidence): void
    {
        $key = $normalized['normalized'];
        if (isset($candidates[$key])) {
            // Prefer an explicit country-code/link signal over a regional
            // interpretation when the same number was found more than once.
            if ($confidence === 'high' && $candidates[$key]['confidence'] !== 'high') {
                $candidates[$key]['confidence'] = $confidence;
                $candidates[$key]['source'] = $source;
                $candidates[$key]['raw'] = $raw;
            }

            return;
        }

        $candidates[$key] = [
            'id' => substr(hash('sha256', $key), 0, 24),
            'raw' => trim($raw),
            'normalized' => $key,
            'display' => $normalized['display'],
            'country_iso2' => $normalized['country_iso2'],
            'country_calling_code' => $normalized['country_calling_code'],
            'source' => $source,
            'confidence' => $confidence,
        ];
    }

    /** @return array<string, mixed> */
    private function normalizedPayload(\libphonenumber\PhoneNumber $number): array
    {
        $region = $this->phoneNumbers->getRegionCodeForNumber($number);
        if ($region === '001') {
            $region = null;
        }

        return [
            'normalized' => $this->phoneNumbers->format($number, PhoneNumberFormat::E164),
            'display' => $this->phoneNumbers->format($number, PhoneNumberFormat::INTERNATIONAL),
            'country_iso2' => $region,
            'country_calling_code' => (string) $number->getCountryCode(),
        ];
    }

    private function normalizeRegion(?string $region): ?string
    {
        $region = strtoupper(trim((string) $region));

        return preg_match('/^[A-Z]{2}$/', $region) ? $region : null;
    }
}
