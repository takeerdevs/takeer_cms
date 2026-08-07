<?php

namespace App\Services;

use App\Contracts\SocialCommerceProvider;
use App\Services\SocialCommerce\FacebookMarketplaceSocialCommerceProvider;
use App\Services\SocialCommerce\InstagramSocialCommerceProvider;
use InvalidArgumentException;

class SocialCommerceProviderRegistry
{
    /** @var SocialCommerceProvider[] */
    private array $providers;

    public function __construct(
        InstagramSocialCommerceProvider $instagram,
        FacebookMarketplaceSocialCommerceProvider $facebook,
    ) {
        $this->providers = [$instagram, $facebook];
    }

    public function providerFor(string $url): SocialCommerceProvider
    {
        foreach ($this->providers as $provider) {
            if ($provider->supports($url)) {
                return $provider;
            }
        }

        throw new InvalidArgumentException('Paste a supported Instagram post/reel, Facebook Marketplace item, or Facebook share link.');
    }

    public function normalize(string $url): array
    {
        return $this->providerFor($url)->normalize($url);
    }

    public function preview(array $link, array $context = []): array
    {
        foreach ($this->providers as $provider) {
            if ($provider->key() === ($link['platform'] ?? null)) {
                return $provider->preview($link, $context);
            }
        }

        throw new InvalidArgumentException('Unsupported social-commerce platform.');
    }

    public function providers(): array { return $this->providers; }
}
