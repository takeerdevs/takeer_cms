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
        if (!config('social_commerce.connected_merchant_fast_path_enabled')) return response()->json(['matched' => false, 'reason' => 'disabled']);
        $match = $fastPath->resolve($data['url']);
        return response()->json($match ? ['matched' => true, 'merchant' => ['id' => $match['merchant']->id, 'display_name' => $match['merchant']->display_name, 'username' => $match['merchant']->username], 'product' => ['id' => $match['product']->id, 'title' => $match['product']->title], 'provenance' => $match['provenance']] : ['matched' => false]);
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
