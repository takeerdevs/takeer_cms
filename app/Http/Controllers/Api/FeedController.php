<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Services\DiscoveryRankingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedController extends Controller
{
    /**
     * GET /api/feed
     * Returns a paginated shoppable post feed with eager-loaded product tags.
     * Zero N+1 queries guaranteed — all eager-loaded.
     */
    public function index(Request $request, DiscoveryRankingService $ranking): JsonResponse
    {
        $posts = $ranking->rankPostQuery(Post::with([
            'merchant:id,display_name,username,avatar_url',
            'merchant.storefrontSetting',
            'linkPreview',
            'linkedContentItem',
            'linkedProduct.attributes',
            'linkedProduct.images',
            'linkedProduct.variants',
            'product.attributes',
            'product.images',
            'product.variants',
            'media.productImage',
            'productTags.product.attributes',
            'productTags.product.images',
            'productTags.product.variants',
            'reactions',
            'promotableBundles',
            'promotableSubscriptions',
        ]))
            ->paginate(10);

        return PostResource::collection($posts)->response();
    }
}
