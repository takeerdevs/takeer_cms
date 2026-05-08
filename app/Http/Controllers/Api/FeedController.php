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
        $perPage = max(4, min(10, (int) $request->integer('per_page', 8)));
        $query = Post::query()
            ->select([
                'id',
                'public_id',
                'merchant_id',
                'content_item_id',
                'link_preview_id',
                'caption',
                'title',
                'excerpt',
                'body',
                'bg_style',
                'is_restricted',
                'restricted_price',
                'comments_enabled_override',
                'reactions_enabled_override',
                'views_count',
                'click_count',
                'likes_count',
                'share_count',
                'comment_count',
                'created_at',
                'updated_at',
                'deleted_at',
            ])
            ->with([
                'merchant:id,user_id,display_name,username,avatar_url,bio,is_verified,is_active,is_suspended',
                'merchant.storefrontSetting',
                'linkPreview',
                'linkedContentItem',
                'linkedProduct.attributes',
                'linkedProduct.images',
                'linkedProduct.variants',
                'linkedProduct.unitType',
                'linkedProduct.packageContentUnitType',
                'linkedProduct.returnPolicy',
                'linkedProduct.faqs',
                'product.attributes',
                'product.images',
                'product.variants',
                'product.unitType',
                'product.packageContentUnitType',
                'product.returnPolicy',
                'product.faqs',
                'media.productImage',
                'productTags.product.attributes',
                'productTags.product.images',
                'productTags.product.variants',
                'productTags.product.unitType',
                'productTags.product.packageContentUnitType',
                'productTags.product.returnPolicy',
                'productTags.product.faqs',
                'reactions',
                'promotableProducts',
                'promotableBundles',
                'promotableSubscriptions',
            ]);

        if ($request->user()) {
            $query->withExists([
                'likes as is_liked_by_viewer' => fn ($likes) => $likes->where('user_id', $request->user()->id),
            ]);
        }

        $posts = $ranking->rankPostQuery($query)->simplePaginate($perPage);

        return PostResource::collection($posts)->response();
    }
}
