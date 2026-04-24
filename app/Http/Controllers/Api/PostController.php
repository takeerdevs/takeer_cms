<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CommentResource;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\PostProductTag;
use App\Models\PostReaction;
use App\Models\PostLike;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class PostController extends Controller
{
    /**
     * Display the specified post (Web view via Inertia).
     */
    public function showByPublicId(Request $request, string $postPublicId): Response|RedirectResponse
    {
        $query = Post::withTrashed()->with([
            'merchant.storefrontSetting',
            'linkedContentItem',
            'media.productImage',
            'linkedProduct.attributes',
            'linkedProduct.images',
            'linkedProduct.variants',
            'product.attributes',
            'product.images',
            'product.variants',
            'productTags.product.attributes',
            'productTags.product.images',
            'productTags.product.variants',
            'reactions',
            'promotableBundles',
            'promotableSubscriptions',
        ])->where('public_id', $postPublicId);

        if (ctype_digit($postPublicId)) {
            $query->orWhere('id', (int) $postPublicId);
        }

        $post = $query->firstOrFail();

        if ($post->public_id && $post->public_id !== $postPublicId) {
            return redirect()->route('post.show', $post->public_id);
        }

        $viewer = $request->user() ?: auth()->guard('web')->user();
        if ($post->trashed() && !$this->canViewDeletedPost($viewer, $post)) {
            abort(404);
        }

        $commentsEnabled = $this->commentsEnabled($post);
        $canAccessComments = $post->trashed()
            ? $this->canViewDeletedPost($viewer, $post)
            : ($commentsEnabled && $this->canAccessPostComments($viewer, $post));

        return Inertia::render('PostDetail', [
            'post' => PostResource::make($post)->resolve(),
            'postId' => $post->id,
            'initialComments' => Inertia::defer(
                fn() => $canAccessComments
                    ? CommentResource::collection(
                        $post->comments()
                            ->whereNull('parent_id')
                            ->with(['user', 'replies.user', 'replies.replies.user'])
                            ->latest()
                            ->paginate(15)
                    )->resolve()
                    : []
            ),
        ]);
    }

    /**
     * Get post data as JSON (for PWA/AJAX updates).
     */
    public function getPostData(Request $request, string $postPublicId): JsonResponse
    {
        $query = Post::withTrashed()->with([
            'merchant.storefrontSetting',
            'merchant_profile',
            'linkedContentItem',
            'media.productImage',
            'linkedProduct.attributes',
            'linkedProduct.images',
            'linkedProduct.variants',
            'product.attributes',
            'product.images',
            'product.variants',
            'productTags.product.attributes',
            'productTags.product.images',
            'productTags.product.variants',
            'reactions',
            'promotableBundles',
            'promotableSubscriptions',
        ])->where('public_id', $postPublicId);

        if (ctype_digit($postPublicId)) {
            $query->orWhere('id', (int) $postPublicId);
        }

        $post = $query->firstOrFail();

        $viewer = $request->user() ?: auth()->guard('web')->user();
        if ($post->trashed() && !$this->canViewDeletedPost($viewer, $post)) {
            return response()->json(['message' => 'Post not found'], 404);
        }

        return response()->json([
            'post' => PostResource::make($post)->resolve(),
        ]);
    }

    /**
     * Store a new social post (merchant).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'caption' => 'nullable|string',
            'title' => 'nullable|string',
            'excerpt' => 'nullable|string',
            'body' => 'nullable|string',
            'bg_style' => 'nullable|string',
            'media_type' => 'required|string|in:text,image,carousel,video',
            'media_url' => 'nullable|string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'product_id' => 'nullable|integer|exists:products,id',
            
            // New Promotion/Restriction Fields
            'is_restricted' => 'nullable|boolean',
            'promotables' => 'nullable|array',
            'promotables.*.id' => 'required|integer',
            'promotables.*.type' => 'required|string|in:product,bundle,subscription_plan',
            'restricted_price' => 'nullable|numeric|min:0',
            'comments_enabled_override' => 'nullable|boolean',
            'reactions_enabled_override' => 'nullable|boolean',
        ]);

        $user = $request->user();
        $merchantProfile = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first();

        if (!$merchantProfile) {
            return response()->json(['message' => 'Tafadhali tengeneza biashara kwanza.'], 403);
        }

        $promotablesInput = $validated['promotables'] ?? [];
        $hasPromotableGate = count($promotablesInput) > 0;
        $hasSingleUnlockPrice = array_key_exists('restricted_price', $validated) && $validated['restricted_price'] !== null;
        $shouldLockPost = (bool) ($validated['is_restricted'] ?? false) || $hasPromotableGate || $hasSingleUnlockPrice;

        $isLongForm = !empty(trim((string) ($validated['body'] ?? '')));
        $isShortForm = !$isLongForm;
        $restrictedPrice = $hasSingleUnlockPrice ? (float) $validated['restricted_price'] : null;
        $paidShortUnlock = $isShortForm && $shouldLockPost && $restrictedPrice !== null && $restrictedPrice > 0;

        if ($paidShortUnlock && empty(trim((string) ($validated['title'] ?? '')))) {
            return response()->json([
                'message' => 'Paid short content must include a title that explains what customers will unlock.',
            ], 422);
        }

        $images = $validated['images'] ?? [];
        $mediaType = $validated['media_type'];
        $mediaUrl = $validated['media_url'] ?? null;

        // 1. Create the Post
        $post = Post::create([
            'merchant_id' => $merchantProfile->id,
            'caption' => $validated['caption'] ?? null,
            'title' => $validated['title'] ?? null,
            'excerpt' => $validated['excerpt'] ?? null,
            'body' => $validated['body'] ?? null,
            'bg_style' => $validated['bg_style'] ?? null,
            'is_restricted' => $shouldLockPost,
            'restricted_price' => $restrictedPrice,
            'comments_enabled_override' => $validated['comments_enabled_override'] ?? null,
            'reactions_enabled_override' => $validated['reactions_enabled_override'] ?? null,
        ]);

        // Attach Promotables
        foreach ($promotablesInput as $promoInput) {
            $modelClass = match ($promoInput['type']) {
                'product' => \App\Models\Product::class,
                'bundle' => \App\Models\Bundle::class,
                'subscription_plan' => \App\Models\SubscriptionPlan::class,
                default => null,
            };

            if ($modelClass) {
                \Illuminate\Support\Facades\DB::table('post_promotables')->insert([
                    'post_id' => $post->id,
                    'promotable_id' => $promoInput['id'],
                    'promotable_type' => $modelClass,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        // 2. Handle Media Linking
        $hasCustomMedia = count($images) > 0 || ($mediaType === 'video' && $mediaUrl);

        if ($hasCustomMedia) {
            // Custom Upload
            if ($mediaType === 'video' && $mediaUrl) {
                $post->media()->create([
                    'media_url' => $mediaUrl,
                    'media_type' => 'video',
                ]);
            } else {
                foreach ($images as $url) {
                    $post->media()->create([
                        'media_url' => $url,
                        'media_type' => 'image',
                    ]);
                }
            }
        } elseif (!empty($validated['product_id'])) {
            // Use Product Media (Legacy/Secondary attachment)
            $product = $user->products()->with('images')->find($validated['product_id']);
            if ($product && $product->images->isNotEmpty()) {
                foreach ($product->images as $image) {
                    $post->media()->create([
                        'product_image_id' => $image->id,
                        'media_type' => 'image',
                    ]);
                }
            }
        }

        // 3. Link Primary Product if attached as product_id
        if (!empty($validated['product_id'])) {
            $product = $user->products()->find($validated['product_id']);
            if ($product) {
                PostProductTag::create([
                    'post_id' => $post->id,
                    'product_id' => $product->id,
                    'x_coordinate' => 50,
                    'y_coordinate' => 50,
                ]);
            }
        }

        $post->load([
            'merchant.storefrontSetting',
            'linkedContentItem',
            'media.productImage',
            'linkedProduct.attributes',
            'linkedProduct.images',
            'linkedProduct.variants',
            'product.attributes',
            'product.images',
            'product.variants',
            'productTags.product.attributes',
            'productTags.product.images',
            'productTags.product.variants',
            'reactions',
            'promotableBundles',
            'promotableSubscriptions',
        ]);

        return response()->json([
            'message' => 'Post imechapishwa!',
            'post' => PostResource::make($post)->resolve(),
        ]);
    }

    /**
     * Get paginated comments for a post (API).
     */
    public function comments(Post $post): JsonResponse
    {
        $viewer = request()->user() ?: auth()->guard('web')->user();

        if ($post->trashed() && !$this->canViewDeletedPost($viewer, $post)) {
            return response()->json(['message' => 'This content is no longer publicly available.'], 403);
        }

        if (!$post->trashed() && !$this->commentsEnabled($post)) {
            return response()->json(['message' => 'Comments are disabled for this post by the merchant.'], 403);
        }

        if (!$post->trashed() && !$this->canAccessPostComments($viewer, $post)) {
            return response()->json(['message' => 'Comments are locked until this post is unlocked.'], 403);
        }

        $perPage = max(10, min(50, (int) request()->integer('per_page', 20)));

        $comments = $post->comments()
            ->whereNull('parent_id')
            ->with(['user', 'replies.user', 'replies.replies.user'])
            ->latest()
            ->simplePaginate($perPage);

        return CommentResource::collection($comments)->response();
    }

    /**
     * Stored a new comment.
     */
    public function storeComment(Request $request, Post $post): JsonResponse
    {
        if ($post->trashed()) {
            return response()->json(['message' => 'Comments are disabled on deleted content.'], 403);
        }

        if (!$this->commentsEnabled($post)) {
            return response()->json(['message' => 'Comments are disabled for this post by the merchant.'], 403);
        }

        if (!$this->canAccessPostComments($request->user(), $post)) {
            return response()->json(['message' => 'Unlock this post first to comment.'], 403);
        }

        $request->validate([
            'text' => 'required|string|max:1000',
            'parent_id' => 'nullable|exists:comments,id',
        ]);

        $resolvedParentId = null;
        if ($request->filled('parent_id')) {
            $parent = $post->comments()
                ->where('id', $request->integer('parent_id'))
                ->first();

            if (!$parent) {
                return response()->json(['message' => 'Invalid reply target for this post.'], 422);
            }

            // Keep discussion at one reply level (Threads-style): replies to replies
            // are attached to the root source comment.
            $resolvedParentId = $parent->parent_id ?: $parent->id;
        }

        $comment = $post->comments()->create([
            'user_id' => $request->user()->id,
            'parent_id' => $resolvedParentId,
            'text' => $request->text,
        ]);

        $post->increment('comment_count');

        return response()->json([
            'message' => 'Maoni yamechapishwa!',
            'comment' => CommentResource::make($comment->load('user')),
        ]);
    }

    /**
     * Add, switch, or clear the current user's reaction on a post.
     */
    public function react(Request $request, Post $post): JsonResponse
    {
        if ($post->trashed()) {
            return response()->json(['message' => 'Reactions are disabled on deleted content.'], 403);
        }

        if (!$this->reactionsEnabled($post)) {
            return response()->json(['message' => 'Reactions are disabled for this post by the merchant.'], 403);
        }

        if (!$this->canAccessPostComments($request->user(), $post)) {
            return response()->json(['message' => 'Unlock this post first to react.'], 403);
        }

        $validated = $request->validate([
            'emoji' => 'nullable|string|max:16',
        ]);

        $user = $request->user();
        $emoji = $validated['emoji'] ?? null;

        /** @var PostReaction|null $existing */
        $existing = $post->reactions()->where('user_id', $user->id)->first();

        if (!$emoji) {
            if ($existing) {
                $existing->delete();
            }
        } elseif ($existing) {
            $existing->update(['emoji' => $emoji]);
        } else {
            $post->reactions()->create([
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
        }

        $summary = $post->reactions()
            ->selectRaw('emoji, COUNT(*) as total')
            ->groupBy('emoji')
            ->get()
            ->map(fn($row) => [
                'emoji' => $row->emoji,
                'count' => (int) ($row->total ?? 0),
            ])->values();

        return response()->json([
            'message' => 'Reaction updated.',
            'my_reaction' => $post->reactions()->where('user_id', $user->id)->value('emoji'),
            'reaction_summary' => $summary,
        ]);
    }

    private function canAccessPostComments($user, Post $post): bool
    {
        $hasPromotableGate = !empty($post->promotable_id) && !empty($post->promotable_type);
        $hasSingleUnlockPrice = $post->restricted_price !== null;
        $isRestricted = (bool) ($post->is_restricted ?? false) || $hasPromotableGate || $hasSingleUnlockPrice;

        if (!$isRestricted) {
            return true;
        }

        if (!$user) {
            return false;
        }

        $entitlements = app(EntitlementService::class);

        if ($hasPromotableGate) {
            $typeMap = [
                \App\Models\Product::class => 'product',
                \App\Models\Bundle::class => 'bundle',
                \App\Models\SubscriptionPlan::class => 'subscription_plan',
            ];
            $shortType = $typeMap[$post->promotable_type] ?? null;
            if ($shortType && $entitlements->hasAccess((int) $user->id, $shortType, (int) $post->promotable_id)) {
                return true;
            }
        }

        if ($hasSingleUnlockPrice && $entitlements->hasAccess((int) $user->id, 'post', (int) $post->id)) {
            return true;
        }

        return false;
    }

    private function commentsEnabled(Post $post): bool
    {
        return $this->interactionSettings($post)['comments_enabled'];
    }

    private function reactionsEnabled(Post $post): bool
    {
        return $this->interactionSettings($post)['reactions_enabled'];
    }

    private function interactionSettings(Post $post): array
    {
        $post->loadMissing('merchant.storefrontSetting');
        $settings = $post->merchant?->storefrontSetting;

        return [
            'comments_enabled' => $post->comments_enabled_override !== null
                ? (bool) $post->comments_enabled_override
                : (bool) ($settings?->allow_post_comments ?? true),
            'reactions_enabled' => $post->reactions_enabled_override !== null
                ? (bool) $post->reactions_enabled_override
                : (bool) ($settings?->allow_post_reactions ?? true),
        ];
    }

    /**
     * Toggle like on a post.
     */
    public function toggleLike(Request $request, Post $post): JsonResponse
    {
        if ($post->trashed()) {
            return response()->json(['message' => 'Reactions are disabled on deleted content.'], 403);
        }

        if (!$this->reactionsEnabled($post)) {
            return response()->json(['message' => 'Reactions are disabled for this post by the merchant.'], 403);
        }

        if (!$this->canAccessPostComments($request->user(), $post)) {
            return response()->json(['message' => 'Unlock this post first to react.'], 403);
        }

        $user = $request->user();
        /** @var \App\Models\PostLike|null $like */
        $like = $post->likes()->where('user_id', $user->id)->first();

        if ($like) {
            $like->delete();
            $post->decrement('likes_count');
            $liked = false;
        } else {
            $post->likes()->create(['user_id' => $user->id]);
            $post->increment('likes_count');
            $liked = true;
        }

        return response()->json([
            'liked' => $liked,
            'like_count' => $post->likes_count,
        ]);
    }

    /**
     * Remove the specified post from storage.
     */
    public function destroy(Request $request, Post $post): JsonResponse
    {
        // Ownership check: merchant's user_id must match the request user
        if ($post->merchant->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Huna ruhusa ya kufuta post hii.'], 403);
        }

        // Keep purchased access history intact while hiding from public/creator feeds.
        $post->update([
            'comments_enabled_override' => false,
            'reactions_enabled_override' => false,
        ]);
        $post->delete();

        return response()->json([
            'message' => 'Post imefutwa kikamilifu.',
        ]);
    }

    private function canViewDeletedPost($user, Post $post): bool
    {
        if (!$user) {
            return false;
        }

        $entitlements = app(EntitlementService::class);

        if ($entitlements->hasAccess((int) $user->id, 'post', (int) $post->id)) {
            return true;
        }

        $hasPromotableGate = !empty($post->promotable_id) && !empty($post->promotable_type);
        if ($hasPromotableGate) {
            $typeMap = [
                \App\Models\Product::class => 'product',
                \App\Models\Bundle::class => 'bundle',
                \App\Models\SubscriptionPlan::class => 'subscription_plan',
            ];
            $shortType = $typeMap[$post->promotable_type] ?? null;
            if ($shortType && $entitlements->hasAccess((int) $user->id, $shortType, (int) $post->promotable_id)) {
                return true;
            }
        }

        return false;
    }
}
