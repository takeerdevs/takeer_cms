<?php

namespace App\Services;

use App\Models\MerchantSocialAccount;
use App\Models\Product;
use App\Models\SocialCommerceRequest;
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

        return [
            'link' => $link,
            'merchant' => $mapping->merchant,
            'product' => $mapping->product,
            'social_product_link' => $mapping,
            'provenance' => data_get($mapping->metadata, 'mapping_source') === 'social_commerce_request'
                ? 'merchant_social_request'
                : 'official_api_connected_account',
        ];
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
            'normalized_url' => $link['normalized_url'], 'status' => 'active', 'verified_at' => now(), 'metadata' => array_merge($metadata ?: [], [
                'mapping_source' => 'official_api_connected_account',
                'mapped_by_user_id' => $user->id,
            ]),
        ]);
    }

    /**
     * Link a buyer's social request to the merchant's canonical Takeer product.
     * This path is intentionally independent of the connected-account fast-path
     * flag: a seller explicitly confirming a request is enough authority to map it.
     */
    public function mapRequestProduct(SocialCommerceRequest $request, Product $product, User $user): SocialProductLink
    {
        $merchant = $request->claimedMerchant;
        if (!$merchant || (int) $merchant->user_id !== (int) $user->id || $merchant->is_suspended || !$merchant->is_active) {
            throw ValidationException::withMessages(['merchant' => 'You do not have access to this merchant request.']);
        }

        if ((int) $product->merchant_id !== (int) $merchant->id || $product->type !== 'physical' || $product->trashed()) {
            throw ValidationException::withMessages(['product_id' => 'Select a physical product owned by the claimed merchant.']);
        }

        $existing = SocialProductLink::query()
            ->where('platform', $request->platform)
            ->where('url_hash', $request->url_hash)
            ->first();

        if ($existing && (int) $existing->merchant_id !== (int) $merchant->id) {
            throw ValidationException::withMessages([
                'product_id' => 'This social post is already linked to another Takeer merchant.',
            ]);
        }

        return SocialProductLink::query()->updateOrCreate([
            'platform' => $request->platform,
            'url_hash' => $request->url_hash,
        ], [
            'merchant_id' => $merchant->id,
            'merchant_social_account_id' => $existing?->merchant_social_account_id,
            'product_id' => $product->id,
            'provider_post_id' => (string) ($request->external_post_id ?: $request->url_hash),
            'normalized_url' => $request->normalized_url ?: $request->original_url,
            'status' => 'active',
            'verified_at' => now(),
            'last_synced_at' => now(),
            'metadata' => array_merge($existing?->metadata ?: [], [
                'mapping_source' => 'social_commerce_request',
                'request_public_id' => $request->public_id,
                'mapped_by_user_id' => $user->id,
            ]),
        ]);
    }
}
