<?php

namespace Tests\Unit;

use App\Services\SocialCommerceProviderRegistry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SocialCommerceUrlNormalizerTest extends TestCase
{
    use RefreshDatabase;

    public function test_instagram_post_urls_are_normalized_and_hashed_without_tracking_parameters(): void
    {
        $link = app(SocialCommerceProviderRegistry::class)->normalize('https://www.instagram.com/p/ABC_123/?utm_source=instagram&fbclid=tracking#comments');

        $this->assertSame('instagram', $link['platform']);
        $this->assertSame('https://instagram.com/p/ABC_123/', $link['normalized_url']);
        $this->assertSame('ABC_123', $link['external_post_id']);
        $this->assertSame(hash('sha256', $link['normalized_url']), $link['url_hash']);
    }

    public function test_facebook_marketplace_locale_urls_are_supported_but_other_facebook_urls_are_rejected(): void
    {
        $registry = app(SocialCommerceProviderRegistry::class);
        $link = $registry->normalize('https://m.facebook.com/sw_TZ/marketplace/item/123456789/?ref=share');

        $this->assertSame('facebook_marketplace', $link['platform']);
        $this->assertSame('123456789', $link['external_post_id']);
        $this->assertSame('https://facebook.com/sw_TZ/marketplace/item/123456789/', $link['normalized_url']);
        $this->expectException(\InvalidArgumentException::class);
        $registry->normalize('https://www.facebook.com/some-page');
    }

    public function test_facebook_marketplace_share_links_are_supported_and_keep_the_share_token_until_resolution(): void
    {
        $registry = app(SocialCommerceProviderRegistry::class);

        foreach (['1FgxsXfWgz', '1Gi74E8BzG'] as $token) {
            $link = $registry->normalize("https://web.facebook.com/share/{$token}/?ref=share");

            $this->assertSame('facebook_marketplace', $link['platform']);
            $this->assertSame("share:{$token}", $link['external_post_id']);
            $this->assertSame("https://facebook.com/share/{$token}/", $link['normalized_url']);
        }
    }
}
