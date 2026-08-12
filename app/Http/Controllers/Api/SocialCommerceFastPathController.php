<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialCommerceRequestInvitation;
use App\Services\SocialCommerceFastPathService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SocialCommerceFastPathController extends Controller
{
    public function resolve(Request $request, SocialCommerceFastPathService $fastPath): JsonResponse
    {
        $data = $request->validate(['url' => ['required', 'url:http,https', 'max:2048']]);
        $match = $fastPath->resolve($data['url']);
        $mappingSource = data_get($match, 'social_product_link.metadata.mapping_source');

        // Manual seller-confirmed mappings are always available. The feature flag
        // still controls mappings created through the connected-account endpoint.
        if (!$match || (!config('social_commerce.connected_merchant_fast_path_enabled') && $mappingSource !== 'social_commerce_request')) {
            return response()->json(['matched' => false]);
        }

        $product = $match['product'];
        $productUrl = route('product.show', ['product' => $product->slug ?: $product->id]);
        $sourceHost = strtolower((string) parse_url((string) data_get($match, 'link.normalized_url'), PHP_URL_HOST));
        $sourceHost = preg_replace('/^www\./', '', $sourceHost);
        $source = $match['link']['platform'] === 'web' ? ($sourceHost ?: 'web') : $match['link']['platform'];
        $trackingUrl = $productUrl.'?'.http_build_query([
            'source' => 'link_buy',
            'utm_source' => $source,
            'utm_medium' => 'external_product_link',
        ]);

        return response()->json([
            'matched' => true,
            'merchant' => [
                'id' => $match['merchant']->id,
                'display_name' => $match['merchant']->display_name,
                'username' => $match['merchant']->username,
            ],
            'product' => [
                'id' => $product->id,
                'title' => $product->title,
                'slug' => $product->slug,
                'price' => $product->price !== null ? (float) $product->price : null,
                'url' => $productUrl,
                'tracking_url' => $trackingUrl,
            ],
            'product_url' => $productUrl,
            'tracking_url' => $trackingUrl,
            'source' => ['key' => $match['link']['platform'], 'label' => $source, 'domain' => $sourceHost ?: null],
            'provenance' => $match['provenance'],
        ]);
    }

    public function map(Request $request, SocialCommerceFastPathService $fastPath): JsonResponse
    {
        $data = $request->validate([
            'merchant_id' => ['required', 'integer'],
            'product_id' => ['required', 'integer'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'social_account_id' => ['nullable', 'integer'],
            'metadata' => ['nullable', 'array'],
        ]);
        $link = $fastPath->map($request->user(), (int) $data['merchant_id'], (int) $data['product_id'], $data['url'], $data['social_account_id'] ?? null, $data['metadata'] ?? null);
        return response()->json(['social_product_link' => $link], 201);
    }

    public function optOut(Request $request, SocialCommerceRequestInvitation $invitation): JsonResponse
    {
        $data = $request->validate(['contact' => ['required', 'string', 'max:80'], 'reason' => ['nullable', 'string', 'max:120']]);
        abort_unless($invitation->recipient_hash === app(\App\Services\SocialCommerceContactSuppressionService::class)->hash($data['contact']), 403);
        app(\App\Services\SocialCommerceContactSuppressionService::class)->suppress($data['contact'], $data['reason'] ?? null);
        return response()->json(['message' => 'This contact will not receive future Takeer social-commerce invitations.']);
    }
}
