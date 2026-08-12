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

    public function test_facebook_marketplace_urls_use_the_specialized_provider_and_other_facebook_urls_use_the_web_provider(): void
    {
        $registry = app(SocialCommerceProviderRegistry::class);
        $link = $registry->normalize('https://m.facebook.com/sw_TZ/marketplace/item/123456789/?ref=share');

        $this->assertSame('facebook_marketplace', $link['platform']);
        $this->assertSame('123456789', $link['external_post_id']);
        $this->assertSame('https://facebook.com/sw_TZ/marketplace/item/123456789/', $link['normalized_url']);
        $generic = $registry->normalize('https://www.facebook.com/some-page');
        $this->assertSame('web', $generic['platform']);
        $this->assertSame('https://www.facebook.com/some-page', $generic['normalized_url']);
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

    public function test_any_public_web_product_url_is_normalized_without_tracking_or_fragments(): void
    {
        $link = app(SocialCommerceProviderRegistry::class)->normalize(
            'https://kupatana.com/tz/product/sofa?utm_source=tiktok&size=large#photos'
        );

        $this->assertSame('web', $link['platform']);
        $this->assertSame('https://kupatana.com/tz/product/sofa?size=large', $link['normalized_url']);
        $this->assertNull($link['external_post_id']);
        $this->assertSame(hash('sha256', $link['normalized_url']), $link['url_hash']);
    }
}
