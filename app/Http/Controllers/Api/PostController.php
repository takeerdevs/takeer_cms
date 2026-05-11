<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\PostEngagementUpdated;
use App\Jobs\ProcessPostMediaVideo;
use App\Http\Resources\CommentResource;
use App\Http\Resources\PostResource;
use App\Models\Bundle;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\PostProductTag;
use App\Models\Product;
use App\Models\PostReaction;
use App\Models\PostLike;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\Wallet;
use App\Services\EntitlementService;
use App\Services\LinkPreviewService;
use App\Services\PhoneService;
use App\Services\PulseNotificationService;
use App\Support\SeoMeta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class PostController extends Controller
{
    /**
     * Display the specified post (Web view via Inertia).
     */
    public function showByPublicId(Request $request, string $postPublicId): Response|RedirectResponse
    {
        $query = Post::withTrashed()->with([
            'merchant.storefrontSetting',
            'linkPreview',
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
            'promotableProducts',
            'promotableBundles',
            'promotableSubscriptions',
            'latestModerationAction',
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
            if (!$post->latestModerationAction?->show_public_notice) {
                abort(404);
            }

            $seo = SeoMeta::post($post);

            return Inertia::render('PostDetail', [
                'post' => PostResource::make($post)->resolve($request),
                'postId' => $post->id,
                'initialComments' => [],
                'seo' => $seo,
            ])->withViewData('seo', $seo);
        }

        // Track traffic
        $post->recordImpression($request);

        $commentsEnabled = $this->commentsEnabled($post);
        $canAccessComments = $post->trashed()
            ? $this->canViewDeletedPost($viewer, $post)
            : ($commentsEnabled && $this->canAccessPostComments($viewer, $post));

        $seo = SeoMeta::post($post);

        return Inertia::render('PostDetail', [
            'post' => PostResource::make($post)->resolve($request),
            'postId' => $post->id,
            'seo' => $seo,
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
        ])->withViewData('seo', $seo);
    }

    /**
     * Get post data as JSON (for PWA/AJAX updates).
     */
    public function getPostData(Request $request, string $postPublicId): JsonResponse
    {
        $query = Post::withTrashed()->with([
            'merchant.storefrontSetting',
            'merchant_profile',
            'linkPreview',
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
            'promotableProducts',
            'promotableBundles',
            'promotableSubscriptions',
            'latestModerationAction',
        ])->where('public_id', $postPublicId);

        if (ctype_digit($postPublicId)) {
            $query->orWhere('id', (int) $postPublicId);
        }

        $post = $query->firstOrFail();

        $viewer = $request->user() ?: auth()->guard('web')->user();
        if ($post->trashed() && !$this->canViewDeletedPost($viewer, $post)) {
            if (!$post->latestModerationAction?->show_public_notice) {
                return response()->json(['message' => 'Post not found'], 404);
            }
        }

        return response()->json([
            'post' => PostResource::make($post)->resolve($request),
        ]);
    }

    /**
     * Store a new social post (merchant).
     */
    public function store(Request $request, LinkPreviewService $linkPreviewService): JsonResponse
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
            'merchant_id' => 'nullable|integer',
            
            // New Promotion/Restriction Fields
            'is_restricted' => 'nullable|boolean',
            'promotables' => 'nullable|array',
            'promotables.*.id' => 'required|integer',
            'promotables.*.type' => 'required|string|in:product,bundle,subscription_plan',
            'restricted_price' => 'nullable|numeric|min:0',
            'comments_enabled_override' => 'nullable|boolean',
            'reactions_enabled_override' => 'nullable|boolean',
        ]);

        $merchantProfile = $this->merchantFromRequest($request);

        if (!$merchantProfile) {
            return response()->json(['message' => 'Tafadhali tengeneza biashara kwanza.'], 403);
        }

        $attachedProduct = null;
        if (!empty($validated['product_id'])) {
            $attachedProduct = Product::query()
                ->where('merchant_id', $merchantProfile->id)
                ->with('images')
                ->find($validated['product_id']);

            if (!$attachedProduct) {
                return response()->json([
                    'message' => 'Product hii haipo kwenye profile uliyochagua.',
                ], 422);
            }
        }

        $promotablesInput = $validated['promotables'] ?? [];
        $hasPromotableGate = count($promotablesInput) > 0;
        $hasSingleUnlockPrice = array_key_exists('restricted_price', $validated) && $validated['restricted_price'] !== null;
        $shouldLockPost = (bool) ($validated['is_restricted'] ?? false) || $hasPromotableGate || $hasSingleUnlockPrice;

        if ($shouldLockPost && ! $this->merchantCanMonetizeContent($merchantProfile)) {
            return response()->json([
                'message' => 'Complete KYC before locking content for payment.',
                'verification_url' => "/merchant/{$merchantProfile->username}/verification",
            ], 403);
        }

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
        $previewSourceText = trim(implode("\n", array_filter([
            $validated['caption'] ?? null,
            $validated['excerpt'] ?? null,
            $validated['body'] ?? null,
        ], fn ($value) => is_string($value) && trim($value) !== '')));
        $linkPreview = $shouldLockPost
            ? null
            : $linkPreviewService->previewForText($previewSourceText);

        // 1. Create the Post
        $post = Post::create([
            'merchant_id' => $merchantProfile->id,
            'link_preview_id' => $linkPreview?->id,
            'source' => 'authored',
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
                'product' => Product::class,
                'bundle' => Bundle::class,
                'subscription_plan' => SubscriptionPlan::class,
                default => null,
            };

            if ($modelClass) {
                $ownedPromotable = $modelClass::query()
                    ->where('merchant_id', $merchantProfile->id)
                    ->whereKey($promoInput['id'])
                    ->exists();

                if (!$ownedPromotable) {
                    return response()->json([
                        'message' => 'Kipengele ulichochagua hakipo kwenye profile hii.',
                    ], 422);
                }

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
                $postMedia = $post->media()->create([
                    'media_url' => $mediaUrl,
                    'media_type' => 'video',
                    'processing_status' => 'pending',
                ]);
                ProcessPostMediaVideo::dispatch($postMedia->id)->afterCommit();
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
            if ($attachedProduct && $attachedProduct->images->isNotEmpty()) {
                foreach ($attachedProduct->images as $image) {
                    $post->media()->create([
                        'product_image_id' => $image->id,
                        'media_type' => 'image',
                    ]);
                }
            }
        }

        // 3. Link Primary Product if attached as product_id
        if ($attachedProduct) {
            PostProductTag::create([
                'post_id' => $post->id,
                'product_id' => $attachedProduct->id,
                'x_coordinate' => 50,
                'y_coordinate' => 50,
            ]);
        }

        $post->load([
            'merchant.storefrontSetting',
            'linkPreview',
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
            'promotableProducts',
            'promotableBundles',
            'promotableSubscriptions',
        ]);

        return response()->json([
            'message' => 'Post imechapishwa!',
            'post' => PostResource::make($post)->resolve(),
        ]);
    }

    private function merchantCanMonetizeContent(Merchant $merchant): bool
    {
        return $merchant->hasCompletedKyc();
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

        $this->broadcastEngagementUpdated($post, 'comment');
        app(PulseNotificationService::class)->postCommentCreated($comment);

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
                app(PulseNotificationService::class)->postReactionCleared($post, (int) $user->id);
            }
        } elseif ($existing) {
            $existing->update(['emoji' => $emoji]);
            app(PulseNotificationService::class)->postReactionUpdated($existing->fresh());
        } else {
            $reaction = $post->reactions()->create([
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
            app(PulseNotificationService::class)->postReactionUpdated($reaction);
        }

        $summary = $post->reactions()
            ->selectRaw('emoji, COUNT(*) as total')
            ->groupBy('emoji')
            ->get()
            ->map(fn($row) => [
                'emoji' => $row->emoji,
                'count' => (int) ($row->total ?? 0),
            ])->values();

        $this->broadcastEngagementUpdated($post, 'reaction');

        return response()->json([
            'message' => 'Reaction updated.',
            'my_reaction' => $post->reactions()->where('user_id', $user->id)->value('emoji'),
            'reaction_summary' => $summary,
        ]);
    }

    public function guestEngagement(Request $request, Post $post): JsonResponse
    {
        if ($post->trashed()) {
            return response()->json(['message' => 'This content is no longer publicly available.'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'phone_number' => ['required', 'string', 'max:20'],
            'otp' => ['required', 'string', 'digits:6'],
            'country_id' => ['nullable', 'exists:countries,id'],
            'action' => ['required', 'in:comment,reaction'],
            'text' => ['required_if:action,comment', 'nullable', 'string', 'max:1000'],
            'parent_id' => ['nullable', 'exists:comments,id'],
            'emoji' => ['required_if:action,reaction', 'nullable', 'string', 'max:16'],
        ]);

        $country = $request->filled('country_id') ? \App\Models\Country::find($request->input('country_id')) : null;
        $rawPhone = trim($validated['phone_number']);
        $formattedPhone = PhoneService::formatToE164($rawPhone, $country?->iso_alpha2 ?: $this->sessionRegion());
        $otpPhones = array_values(array_unique(array_filter([$formattedPhone, $rawPhone])));

        $throttleKey = 'guest-engagement-otp:' . sha1($request->ip() . '|' . ($formattedPhone ?: $rawPhone));
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return response()->json([
                'message' => 'Too many attempts. Please wait a bit and try again.',
                'retry_after_seconds' => RateLimiter::availableIn($throttleKey),
            ], 429);
        }

        $cacheKey = null;
        $hashedOtp = null;
        foreach ($otpPhones as $candidatePhone) {
            $candidateKey = "otp:{$candidatePhone}";
            $candidateOtp = Cache::get($candidateKey);
            if ($candidateOtp) {
                $cacheKey = $candidateKey;
                $hashedOtp = $candidateOtp;
                break;
            }
        }

        if (!$hashedOtp || !Hash::check($validated['otp'], $hashedOtp)) {
            RateLimiter::hit($throttleKey, 600);

            return response()->json(['message' => 'The OTP is incorrect or has expired.'], 422);
        }

        $phone = $formattedPhone ?: $rawPhone;

        if ($validated['action'] === 'comment' && !$this->commentsEnabled($post)) {
            return response()->json(['message' => 'Comments are disabled for this post by the merchant.'], 403);
        }

        if ($validated['action'] === 'reaction' && !$this->reactionsEnabled($post)) {
            return response()->json(['message' => 'Reactions are disabled for this post by the merchant.'], 403);
        }

        $user = User::whereIn('phone_number', PhoneService::variantsForLookup($phone, $country))->first();
        $name = trim($validated['name']);
        if (!$user && !$this->canAccessPostComments(null, $post)) {
            return response()->json(['message' => 'Unlock this post first to engage.'], 403);
        }

        if (!$user) {
            $user = User::create([
                'name' => $name,
                'phone_number' => $phone,
                'phone_verified_at' => now(),
                'role' => 'buyer',
            ]);
        } else {
            $updates = ['phone_verified_at' => $user->phone_verified_at ?: now()];
            if (trim((string) $user->name) === '' || str_starts_with((string) $user->name, 'User ')) {
                $updates['name'] = $name;
            }
            $user->forceFill($updates)->save();
        }

        if (!$user->wallet) {
            Wallet::create(['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]);
        }

        if (!$this->canAccessPostComments($user, $post)) {
            return response()->json(['message' => 'Unlock this post first to engage.'], 403);
        }

        Cache::forget($cacheKey);
        RateLimiter::clear($throttleKey);
        Auth::guard('web')->login($user, true);
        $request->session()->regenerate();

        if ($validated['action'] === 'comment') {
            $resolvedParentId = null;
            if ($request->filled('parent_id')) {
                $parent = $post->comments()
                    ->where('id', $request->integer('parent_id'))
                    ->first();

                if (!$parent) {
                    return response()->json(['message' => 'Invalid reply target for this post.'], 422);
                }

                $resolvedParentId = $parent->parent_id ?: $parent->id;
            }

            $comment = $post->comments()->create([
                'user_id' => $user->id,
                'parent_id' => $resolvedParentId,
                'text' => $validated['text'],
            ]);
            $post->increment('comment_count');
            $this->broadcastEngagementUpdated($post, 'comment');
            app(PulseNotificationService::class)->postCommentCreated($comment);

            return response()->json([
                'message' => 'Your comment has been posted.',
                'user' => \App\Http\Resources\UserResource::make($user),
                'comment' => CommentResource::make($comment->load('user')),
                'comment_count' => $post->fresh()->comment_count,
            ]);
        }

        $emoji = $validated['emoji'];
        $existing = $post->reactions()->where('user_id', $user->id)->first();
        if ($existing) {
            $existing->update(['emoji' => $emoji]);
            app(PulseNotificationService::class)->postReactionUpdated($existing->fresh());
        } else {
            $reaction = $post->reactions()->create([
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
            app(PulseNotificationService::class)->postReactionUpdated($reaction);
        }

        $summary = $post->reactions()
            ->selectRaw('emoji, COUNT(*) as total')
            ->groupBy('emoji')
            ->get()
            ->map(fn($row) => [
                'emoji' => $row->emoji,
                'count' => (int) ($row->total ?? 0),
            ])->values();

        $this->broadcastEngagementUpdated($post, 'reaction');

        return response()->json([
            'message' => 'Reaction added.',
            'user' => \App\Http\Resources\UserResource::make($user),
            'my_reaction' => $post->reactions()->where('user_id', $user->id)->value('emoji'),
            'reaction_summary' => $summary,
        ]);
    }

    private function canAccessPostComments($user, Post $post): bool
    {
        return $this->userCanAccessPost($user, $post, true);
    }

    private function broadcastEngagementUpdated(Post $post, string $type): void
    {
        try {
            broadcast(new PostEngagementUpdated($post, $type));
        } catch (Throwable $exception) {
            Log::warning('Post engagement broadcast failed.', [
                'post_id' => $post->id,
                'type' => $type,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    private function sessionRegion(): string
    {
        $sessionCountry = session('user_session_country');

        return $sessionCountry['iso_alpha2'] ?? 'TZ';
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
    public function destroy(Request $request, Merchant|string|Post $merchantOrPost, ?Post $post = null): JsonResponse
    {
        $scopedMerchant = $merchantOrPost instanceof Post ? $request->route('merchant') : $merchantOrPost;
        $post = $merchantOrPost instanceof Post ? $merchantOrPost : $post;

        abort_unless($post instanceof Post, 404);

        if (!$scopedMerchant instanceof Merchant && $scopedMerchant) {
            $scopedMerchant = Merchant::where('username', $scopedMerchant)->firstOrFail();
        }

        if ($scopedMerchant && (int) $post->merchant_id !== (int) $scopedMerchant->id) {
            return response()->json(['message' => 'Post hii haipo kwenye profile hii.'], 404);
        }

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
        return $this->userCanAccessPost($user, $post, false);
    }

    private function userCanAccessPost($user, Post $post, bool $allowPublicUnrestricted = true): bool
    {
        $post->loadMissing([
            'merchant',
            'linkedContentItem',
            'promotableProducts',
            'promotableBundles',
            'promotableSubscriptions',
        ]);

        $promotables = $post->promotables ?? collect();
        $linkedContentItem = $post->linkedContentItem;
        $hasPromotableGate = $promotables->isNotEmpty();
        $hasSingleUnlockPrice = $post->restricted_price !== null;
        $hasPaidLinkedContent = $linkedContentItem && $linkedContentItem->price !== null;
        $isRestricted = (bool) ($post->is_restricted ?? false) || $hasPromotableGate || $hasSingleUnlockPrice || $hasPaidLinkedContent;

        if (!$isRestricted && $allowPublicUnrestricted) {
            return true;
        }

        if (!$user) {
            return false;
        }

        if ((bool) ($user->is_admin ?? false) || (int) ($post->merchant?->user_id ?? 0) === (int) $user->id) {
            return true;
        }

        $entitlements = app(EntitlementService::class);

        if ($entitlements->hasAccess((int) $user->id, 'post', (int) $post->id)) {
            return true;
        }

        if ($linkedContentItem && $entitlements->hasAccess((int) $user->id, 'content_item', (int) $linkedContentItem->id)) {
            return true;
        }

        $typeMap = [
            \App\Models\Product::class => 'product',
            \App\Models\Bundle::class => 'bundle',
            \App\Models\SubscriptionPlan::class => 'subscription_plan',
        ];

        foreach ($promotables as $promotable) {
            $shortType = $typeMap[get_class($promotable)] ?? null;
            if ($shortType && $entitlements->hasAccess((int) $user->id, $shortType, (int) $promotable->id)) {
                return true;
            }
        }

        return false;
    }

    private function merchantFromRequest(Request $request): ?Merchant
    {
        $routeMerchant = $request->route('merchant') ?: $request->attributes->get('resolved_merchant');

        if ($routeMerchant instanceof Merchant) {
            return $routeMerchant;
        }

        if ($routeMerchant) {
            return Merchant::query()
                ->where('username', $routeMerchant)
                ->where('user_id', $request->user()->id)
                ->firstOrFail();
        }

        $merchantId = $request->input('merchant_id') ?? $request->query('merchant_id') ?? session('active_merchant_id');

        if ($merchantId) {
            $merchant = $request->user()
                ->merchantProfiles()
                ->where('id', $merchantId)
                ->first();

            if ($merchant) {
                return $merchant;
            }
        }

        return $request->user()->merchantProfiles()->where('is_default', true)->first()
            ?? $request->user()->merchantProfiles()->first();
    }
}
