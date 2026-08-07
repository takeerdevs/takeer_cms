<?php

namespace App\Services;

use App\Models\MerchantSocialAccount;
use App\Models\Product;
use App\Models\SocialProductLink;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class SocialCommerceFastPathService
{
    public function __construct(private readonly SocialCommercePreviewService $previews) {}

    public function resolve(string $url): ?array
    {
        $link = $this->previews->normalize($url);
        $mapping = SocialProductLink::query()->with(['merchant', 'product', 'merchantSocialAccount'])->where('platform', $link['platform'])->where('url_hash', $link['url_hash'])->where('status', 'active')->first();
        if (!$mapping || !$mapping->merchant || !$mapping->product || $mapping->merchant->is_suspended || !$mapping->merchant->is_active) return null;
        return ['link' => $link, 'merchant' => $mapping->merchant, 'product' => $mapping->product, 'social_product_link' => $mapping, 'provenance' => 'official_api_connected_account'];
    }

    public function map(User $user, int $merchantId, int $productId, string $url, ?int $socialAccountId = null, ?array $metadata = null): SocialProductLink
    {
        if (!config('social_commerce.connected_merchant_fast_path_enabled')) {
            throw ValidationException::withMessages(['feature' => 'Connected social-product mapping is disabled.']);
        }
        $merchant = $user->merchantProfiles()->whereKey($merchantId)->firstOrFail();
        $product = Product::query()->whereKey($productId)->where('merchant_id', $merchant->id)->firstOrFail();
        $link = $this->previews->normalize($url);
        $requiredPlatform = $link['platform'] === 'facebook_marketplace' ? ['facebook', 'facebook_marketplace'] : [$link['platform']];
        $account = $socialAccountId ? MerchantSocialAccount::query()->whereKey($socialAccountId)->where('merchant_id', $merchant->id)->whereIn('platform', $requiredPlatform)->where('status', 'connected')->first() : null;
        if ($socialAccountId && !$account) throw ValidationException::withMessages(['social_account_id' => 'Select a connected social account owned by this merchant.']);
        return SocialProductLink::query()->updateOrCreate([
            'platform' => $link['platform'], 'url_hash' => $link['url_hash'],
        ], [
            'merchant_id' => $merchant->id, 'merchant_social_account_id' => $account?->id,
            'product_id' => $product->id, 'provider_post_id' => $link['external_post_id'],
            'normalized_url' => $link['normalized_url'], 'status' => 'active', 'verified_at' => now(), 'metadata' => array_merge($metadata ?: [], ['mapped_by_user_id' => $user->id]),
        ]);
    }
}
