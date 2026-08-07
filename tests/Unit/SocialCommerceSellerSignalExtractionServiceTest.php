<?php

namespace Tests\Unit;

use App\Services\SocialCommerceSellerSignalExtractionService;
use Tests\TestCase;

class SocialCommerceSellerSignalExtractionServiceTest extends TestCase
{
    public function test_instagram_caption_metadata_handle_is_extracted(): void
    {
        $signals = app(SocialCommerceSellerSignalExtractionService::class)->extract([
            'title' => 'Top Africa company limited on Instagram',
            'description' => '1 likes, 0 comments - majengo_general_traders on August 3, 2026: "Gasoline lawn mower"',
            'site_name' => 'Instagram',
        ], 'instagram');

        $this->assertSame('majengo_general_traders', $signals['handle']);
        $this->assertSame('https://www.instagram.com/majengo_general_traders/', $signals['profile_url']);
        $this->assertSame('public_metadata', $signals['source']);
        $this->assertSame('caption_metadata', $signals['matched_by']);
    }

    public function test_explicit_handle_and_profile_url_are_supported(): void
    {
        $service = app(SocialCommerceSellerSignalExtractionService::class);

        $explicit = $service->extract(['description' => 'Seller: @global.shop_24'], 'instagram');
        $profile = $service->extract(['description' => 'Profile: https://www.instagram.com/global.shop_24/'], 'instagram');

        $this->assertSame('global.shop_24', $explicit['handle']);
        $this->assertSame('explicit_handle', $explicit['matched_by']);
        $this->assertSame('global.shop_24', $profile['handle']);
        $this->assertSame('profile_url', $profile['matched_by']);
    }

    public function test_facebook_profile_url_is_extracted_without_treating_a_marketplace_path_as_a_handle(): void
    {
        $service = app(SocialCommerceSellerSignalExtractionService::class);

        $signals = $service->extract([
            'description' => 'Seller: https://www.facebook.com/majengo.traders/',
        ], 'facebook_marketplace');
        $listingOnly = $service->extract([
            'description' => 'https://www.facebook.com/marketplace/item/123456789/',
        ], 'facebook_marketplace');

        $this->assertSame('majengo.traders', $signals['handle']);
        $this->assertSame('https://www.facebook.com/majengo.traders/', $signals['profile_url']);
        $this->assertNull($listingOnly['handle']);
    }

    public function test_display_name_without_a_handle_is_not_mistaken_for_one(): void
    {
        $signals = app(SocialCommerceSellerSignalExtractionService::class)->extract([
            'title' => 'Top Africa company limited on Instagram',
            'description' => 'Gasoline lawn mower available at our store.',
        ], 'instagram');

        $this->assertNull($signals['handle']);
        $this->assertSame([], $signals['candidates']);
    }
}
