<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Post;
use App\Services\ContentPolicyService;
use App\Support\MerchantPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MerchantContentController extends Controller
{
    public function posts(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $settings = $merchant->storefrontSetting;
        $globalComments = (bool) ($settings?->allow_post_comments ?? true);
        $globalReactions = (bool) ($settings?->allow_post_reactions ?? true);

        $posts = Post::where('merchant_id', $merchant->id)
            ->when($request->filled('source'), fn ($query) => $query->where('source', $request->string('source')->toString()))
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = '%' . $request->string('q')->toString() . '%';

                $query->where(function ($inner) use ($term) {
                    $inner->where('title', 'like', $term)
                        ->orWhere('caption', 'like', $term);
                });
            })
            ->when($request->string('post_type')->toString() === 'long', function ($query) {
                $query->whereHas('linkedContentItem', fn ($contentQuery) => $contentQuery->whereIn('format', ['editorjs', 'markdown', 'html']));
            })
            ->when($request->string('post_type')->toString() === 'short', function ($query) {
                $query->where(function ($inner) {
                    $inner->whereDoesntHave('linkedContentItem')
                        ->orWhereHas('linkedContentItem', fn ($contentQuery) => $contentQuery->whereNotIn('format', ['editorjs', 'markdown', 'html']));
                });
            })
            ->with([
                'linkedContentItem:id,format,visibility,price',
                'media:id,post_id,media_url,media_type,product_image_id',
                'media.productImage:id,image_url',
                'createdByUser:id,name',
                'createdByStaff:id,display_name,job_title,user_id',
            ])
            ->latest()
            ->paginate(30);

        $posts->setCollection(
            $posts->getCollection()->map(function (Post $post) use ($globalComments, $globalReactions) {
                $effectiveComments = $post->comments_enabled_override !== null
                    ? (bool) $post->comments_enabled_override
                    : $globalComments;
                $effectiveReactions = $post->reactions_enabled_override !== null
                    ? (bool) $post->reactions_enabled_override
                    : $globalReactions;
                $contentFormat = $post->linkedContentItem?->format;
                $postType = in_array($contentFormat, ['editorjs', 'markdown', 'html'], true) ? 'long' : 'short';
                $coverImage = $post->media->firstWhere('media_type', 'image')?->url;

                return [
                    'id' => $post->id,
                    'public_id' => $post->public_id,
                    'source' => $post->source,
                    'title' => $post->title,
                    'caption' => Str::limit((string) $post->caption, 140),
                    'post_type' => $postType,
                    'content_format' => $contentFormat,
                    'content_visibility' => $post->linkedContentItem?->visibility,
                    'content_price' => $post->linkedContentItem?->price,
                    'created_by' => $this->creatorPayload($post),
                    'cover_image' => $coverImage,
                    'created_at' => $post->created_at?->toISOString(),
                    'views_count' => (int) ($post->views_count ?? 0),
                    'likes_count' => (int) ($post->likes_count ?? 0),
                    'comment_count' => (int) ($post->comment_count ?? 0),
                    'comments_enabled_override' => $post->comments_enabled_override,
                    'reactions_enabled_override' => $post->reactions_enabled_override,
                    'global_comments_enabled' => $globalComments,
                    'global_reactions_enabled' => $globalReactions,
                    'comments_enabled' => $effectiveComments,
                    'reactions_enabled' => $effectiveReactions,
                ];
            })
        );

        return response()->json($posts);
    }

    public function updatePostInteraction(Request $request, Post $post): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $post->merchant_id);

        $validated = $request->validate([
            'comments_enabled_override' => 'nullable|boolean',
            'reactions_enabled_override' => 'nullable|boolean',
        ]);

        if (array_key_exists('comments_enabled_override', $validated)) {
            $post->comments_enabled_override = $validated['comments_enabled_override'];
        }

        if (array_key_exists('reactions_enabled_override', $validated)) {
            $post->reactions_enabled_override = $validated['reactions_enabled_override'];
        }

        $post->save();

        $settings = $merchant->storefrontSetting;

        return response()->json([
            'message' => 'Post moderation overrides updated.',
            'post' => [
                'id' => $post->id,
                'comments_enabled_override' => $post->comments_enabled_override,
                'reactions_enabled_override' => $post->reactions_enabled_override,
                'global_comments_enabled' => (bool) ($settings?->allow_post_comments ?? true),
                'global_reactions_enabled' => (bool) ($settings?->allow_post_reactions ?? true),
                'comments_enabled' => $post->comments_enabled_override !== null
                    ? (bool) $post->comments_enabled_override
                    : (bool) ($settings?->allow_post_comments ?? true),
                'reactions_enabled' => $post->reactions_enabled_override !== null
                    ? (bool) $post->reactions_enabled_override
                    : (bool) ($settings?->allow_post_reactions ?? true),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $contents = ContentItem::where('merchant_id', $merchant->id)
            ->latest()
            ->paginate(20);

        return response()->json($contents);
    }

    public function show(Request $request, ContentItem $contentItem): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $contentItem->merchant_id);

        return response()->json(['content_item' => $contentItem]);
    }

    public function store(Request $request, ContentPolicyService $policyService): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'excerpt' => 'nullable|string|max:500',
            'body' => 'required|string',
            'format' => 'nullable|string|in:plain_text,markdown,html,editorjs',
            'visibility' => 'nullable|string|in:draft,published,archived',
            'price' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'bg_style' => 'nullable|string|in:gradient_sunset,gradient_ocean,gradient_forest,gradient_midnight,gradient_fire,solid_black,solid_brand,solid_white',
        ]);

        $moderation = $policyService->moderateText(($validated['title'] ?? '') . "\n" . ($validated['body'] ?? ''));

        $contentItem = ContentItem::create([
            ...$validated,
            'merchant_id' => $merchant->id,
            'slug' => Str::slug($validated['title']) . '-' . Str::lower(Str::random(6)),
            'moderation_status' => $moderation['status'],
            'moderation_notes' => $moderation['notes'],
            'published_at' => (($validated['visibility'] ?? 'draft') === 'published' && $moderation['allowed']) ? now() : null,
        ]);

        if (($validated['visibility'] ?? 'draft') === 'published' && $moderation['allowed']) {
            $this->syncFeedPostForPublishedContent($contentItem, $validated['bg_style'] ?? null, $request);
        }

        return response()->json([
            'message' => 'Content saved.',
            'content_item' => $contentItem,
            'moderation' => $moderation,
        ], 201);
    }

    public function update(Request $request, ContentItem $contentItem, ContentPolicyService $policyService): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $contentItem->merchant_id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'excerpt' => 'nullable|string|max:500',
            'body' => 'sometimes|required|string',
            'format' => 'nullable|string|in:plain_text,markdown,html,editorjs',
            'visibility' => 'nullable|string|in:draft,published,archived',
            'price' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'bg_style' => 'nullable|string|in:gradient_sunset,gradient_ocean,gradient_forest,gradient_midnight,gradient_fire,solid_black,solid_brand,solid_white',
        ]);

        $title = $validated['title'] ?? $contentItem->title;
        $body = $validated['body'] ?? $contentItem->body;
        $moderation = $policyService->moderateText($title . "\n" . $body);

        $wasPublished = $contentItem->visibility === 'published';

        $contentItem->update([
            ...$validated,
            'slug' => array_key_exists('title', $validated)
                ? Str::slug($validated['title']) . '-' . Str::lower(Str::random(6))
                : $contentItem->slug,
            'moderation_status' => $moderation['status'],
            'moderation_notes' => $moderation['notes'],
            'published_at' => (($validated['visibility'] ?? $contentItem->visibility) === 'published' && $moderation['allowed'])
                ? ($contentItem->published_at ?? now())
                : null,
        ]);

        $isPublished = ($validated['visibility'] ?? $contentItem->visibility) === 'published' && $moderation['allowed'];
        if ($isPublished) {
            $this->syncFeedPostForPublishedContent($contentItem->fresh(), $validated['bg_style'] ?? null, $request);
        } elseif ($wasPublished) {
            Post::where('content_item_id', $contentItem->id)->delete();
        }

        return response()->json([
            'message' => 'Content updated.',
            'content_item' => $contentItem->fresh(),
            'moderation' => $moderation,
        ]);
    }

    public function destroy(Request $request, ContentItem $contentItem): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $contentItem->merchant_id);

        Post::where('content_item_id', $contentItem->id)->update([
            'comments_enabled_override' => false,
            'reactions_enabled_override' => false,
        ]);
        $contentItem->delete();
        Post::where('content_item_id', $contentItem->id)->delete();

        return response()->json(['message' => 'Content deleted.']);
    }

    private function merchantFromRequest(Request $request)
    {
        $routeMerchant = $request->route('merchant');
        if ($routeMerchant instanceof Merchant) {
            return $routeMerchant;
        }

        $user = $request->user();
        $merchantId = $request->input('merchant_id') ?? $request->query('merchant_id') ?? session('active_merchant_id');
        if ($merchantId) {
            $merchant = \App\Support\MerchantPermissions::accessibleMerchantsFor($user)->firstWhere('id', (int) $merchantId);
            if ($merchant) {
                return $merchant;
            }
        }

        $merchant = $user->merchantProfiles()->where('is_default', true)->first()
            ?? $user->merchantProfiles()->first()
            ?? \App\Support\MerchantPermissions::accessibleMerchantsFor($user)->first();

        abort_unless($merchant, 403, 'Merchant profile not found.');

        return $merchant;
    }

    private function ensureOwnership(int $merchantId, int $contentMerchantId): void
    {
        abort_if($merchantId !== $contentMerchantId, 403, 'Unauthorized.');
    }

    private function creatorPayload(Post $post): ?array
    {
        $staff = $post->createdByStaff;
        $user = $post->createdByUser;

        if (! $staff && ! $user) {
            return null;
        }

        $displayName = $staff?->display_name
            ?: $staff?->job_title
            ?: $user?->name;

        return [
            'user_id' => $user?->id,
            'staff_id' => $staff?->id,
            'name' => $displayName,
            'user_name' => $user?->name,
            'job_title' => $staff?->job_title,
            'label' => $displayName ? "via {$displayName}" : null,
        ];
    }

    private function syncFeedPostForPublishedContent(ContentItem $contentItem, ?string $bgStyle = null, ?Request $request = null): void
    {
        $internalShortTitle = '__short_locked__';
        $isShortForm = $contentItem->format === 'plain_text';
        $displayTitle = ($isShortForm && trim((string) $contentItem->title) === $internalShortTitle)
            ? null
            : $contentItem->title;
        $existingFeedPost = Post::where('content_item_id', $contentItem->id)->first();
        $resolvedBgStyle = $bgStyle ?? $existingFeedPost?->bg_style;
        $actingStaff = $request?->user() && $contentItem->merchant
            ? MerchantPermissions::staffFor($request->user(), $contentItem->merchant)
            : null;

        $previewText = trim((string) ($contentItem->excerpt ?: Str::limit(trim(strip_tags((string) $contentItem->body)), 240)));

        $lines = array_filter([
            $displayTitle,
            $previewText,
        ]);

        Post::updateOrCreate(
            ['content_item_id' => $contentItem->id],
            [
                'merchant_id' => $contentItem->merchant_id,
                'created_by_user_id' => $existingFeedPost?->created_by_user_id ?: $request?->user()?->id,
                'created_by_staff_id' => $existingFeedPost?->created_by_staff_id ?: $actingStaff?->id,
                'source' => 'content_publish',
                'caption' => implode("\n\n", $lines),
                'bg_style' => $resolvedBgStyle,
            ]
        );
    }
}
