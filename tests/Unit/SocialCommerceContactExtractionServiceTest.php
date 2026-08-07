<?php

namespace Tests\Unit;

use App\Services\SocialCommerceContactExtractionService;
use Tests\TestCase;

class SocialCommerceContactExtractionServiceTest extends TestCase
{
    public function test_explicit_international_numbers_are_extracted_without_a_local_country_assumption(): void
    {
        $candidates = app(SocialCommerceContactExtractionService::class)->extract(
            'Call +44 7911 123456 or WhatsApp +1 (202) 555-0123.',
        );

        $this->assertSame(['+447911123456', '+12025550123'], array_column($candidates, 'normalized'));
        $this->assertSame(['GG', 'US'], array_column($candidates, 'country_iso2'));
        $this->assertSame(['high', 'high'], array_column($candidates, 'confidence'));
    }

    public function test_local_numbers_are_normalized_only_when_a_region_is_available(): void
    {
        $service = app(SocialCommerceContactExtractionService::class);

        $this->assertSame([], $service->extract('Contact 0763 141 335.'));
        $candidates = $service->extract('Contact 0763 141 335.', 'TZ');

        $this->assertCount(1, $candidates);
        $this->assertSame('+255763141335', $candidates[0]['normalized']);
        $this->assertSame('TZ', $candidates[0]['country_iso2']);
        $this->assertSame('medium', $candidates[0]['confidence']);
    }

    public function test_dial_out_prefixes_and_whatsapp_links_are_supported(): void
    {
        $service = app(SocialCommerceContactExtractionService::class);
        $candidates = $service->extract('SMS 0044 7911 123456 or https://wa.me/255763141335');

        $this->assertSame(['+447911123456', '+255763141335'], array_column($candidates, 'normalized'));
        $this->assertSame(['post_text', 'contact_link'], array_column($candidates, 'source'));
    }

    public function test_invalid_numbers_are_not_accepted_for_sms(): void
    {
        $this->assertNull(app(SocialCommerceContactExtractionService::class)->normalize('12345', 'TZ'));
        $this->assertSame('+447911123456', app(SocialCommerceContactExtractionService::class)->normalize('0044 7911 123456')['normalized']);
    }
}
