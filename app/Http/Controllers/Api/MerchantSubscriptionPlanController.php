<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\SubscriptionPlanItem;
use App\Models\UserSubscription;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MerchantSubscriptionPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $plans = SubscriptionPlan::where('merchant_id', $merchant->id)
            ->with('items')
            ->withCount([
                'subscriptions as active_members_count' => fn ($query) => $query
                    ->where('status', 'active')
                    ->where(fn ($periodQuery) => $periodQuery
                        ->whereNull('current_period_end')
                        ->orWhere('current_period_end', '>', now())),
                'subscriptions as total_members_count',
            ])
            ->orderBy('tier')
            ->latest()
            ->get();

        return response()->json(['plans' => $plans, 'data' => $plans]);
    }

    public function show(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $subscriptionPlan->load('items');
        $subscriptionPlan->loadCount([
            'subscriptions as active_members_count' => fn ($query) => $query
                ->where('status', 'active')
                ->where(fn ($periodQuery) => $periodQuery
                    ->whereNull('current_period_end')
                    ->orWhere('current_period_end', '>', now())),
            'subscriptions as total_members_count',
        ]);

        return response()->json(['subscription_plan' => $subscriptionPlan, 'data' => $subscriptionPlan]);
    }

    public function store(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $entitlementService = app(EntitlementService::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'billing_interval' => 'required|string|in:hourly,daily,weekly,monthly',
            'interval_count' => 'nullable|integer|min:1|max:365',
            'weekly_days' => 'nullable|array',
            'weekly_days.*' => 'string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            'monthly_day' => 'nullable|integer|min:1|max:28',
            'trial_days' => 'nullable|integer|min:0|max:60',
            'tier' => 'nullable|integer|min:1|max:100',
            'status' => 'nullable|string|in:draft,active,archived',
            'publish_targets' => 'nullable|array',
            'publish_targets.takeer' => 'nullable|boolean',
            'publish_targets.instagram' => 'nullable|boolean',
            'publish_targets.facebook' => 'nullable|boolean',
            'publish_targets.x' => 'nullable|boolean',
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:content_item,bundle,product',
            'items.*.item_id' => 'required_with:items|integer|min:1',
            'items.*.unlock_after_days' => 'nullable|integer|min:0|max:3650',
        ]);

        $this->validatePlanSchedule($validated);

        $plan = DB::transaction(function () use ($validated, $merchant) {
            $plan = SubscriptionPlan::create([
                'merchant_id' => $merchant->id,
                'name' => $validated['name'],
                'slug' => Str::slug($validated['name']) . '-' . Str::lower(Str::random(6)),
                'description' => $validated['description'] ?? null,
                'price' => $validated['price'],
                'currency_id' => $validated['currency_id'] ?? null,
                'billing_interval' => $validated['billing_interval'],
                'interval_count' => $validated['interval_count'] ?? 1,
                'weekly_days' => $validated['weekly_days'] ?? null,
                'monthly_day' => $validated['monthly_day'] ?? null,
                'trial_days' => $validated['trial_days'] ?? null,
                'tier' => $validated['tier'] ?? 1,
                'status' => $validated['status'] ?? 'draft',
            ]);

            foreach ($validated['items'] ?? [] as $item) {
                $this->assertItemBelongsToMerchant($merchant->id, $item['item_type'], (int) $item['item_id']);
                $plan->items()->create([
                    'item_type' => $item['item_type'],
                    'item_id' => $item['item_id'],
                    'unlock_after_days' => $item['unlock_after_days'] ?? 0,
                ]);
            }

            return $plan;
        });

        $entitlementService->syncActiveSubscribersForPlan((int) $plan->id);
        if (($validated['status'] ?? 'draft') === 'active' && $this->shouldPublishToTakeer($validated)) {
            $this->syncFeedPostForActivePlan($plan->fresh(['items']));
        }

        return response()->json([
            'message' => 'Subscription plan created.',
            'subscription_plan' => $plan->load('items'),
        ], 201);
    }

    public function update(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $entitlementService = app(EntitlementService::class);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'sometimes|required|numeric|min:0',
            'currency_id' => 'nullable|integer|exists:currencies,id',
            'billing_interval' => 'nullable|string|in:hourly,daily,weekly,monthly',
            'interval_count' => 'nullable|integer|min:1|max:365',
            'weekly_days' => 'nullable|array',
            'weekly_days.*' => 'string|in:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
            'monthly_day' => 'nullable|integer|min:1|max:28',
            'trial_days' => 'nullable|integer|min:0|max:60',
            'tier' => 'nullable|integer|min:1|max:100',
            'status' => 'nullable|string|in:draft,active,archived',
            'publish_targets' => 'nullable|array',
            'publish_targets.takeer' => 'nullable|boolean',
            'publish_targets.instagram' => 'nullable|boolean',
            'publish_targets.facebook' => 'nullable|boolean',
            'publish_targets.x' => 'nullable|boolean',
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:content_item,bundle,product',
            'items.*.item_id' => 'required_with:items|integer|min:1',
            'items.*.unlock_after_days' => 'nullable|integer|min:0|max:3650',
        ]);

        $effective = [
            'billing_interval' => $validated['billing_interval'] ?? $subscriptionPlan->billing_interval,
            'weekly_days' => $validated['weekly_days'] ?? $subscriptionPlan->weekly_days,
            'monthly_day' => $validated['monthly_day'] ?? $subscriptionPlan->monthly_day,
        ];
        $this->validatePlanSchedule($effective);

        DB::transaction(function () use ($validated, $subscriptionPlan, $merchant) {
            $subscriptionPlan->update([
                ...collect($validated)->except(['items', 'publish_targets'])->toArray(),
                'slug' => array_key_exists('name', $validated)
                    ? Str::slug($validated['name']) . '-' . Str::lower(Str::random(6))
                    : $subscriptionPlan->slug,
            ]);

            if (array_key_exists('items', $validated)) {
                $subscriptionPlan->items()->delete();
                foreach ($validated['items'] as $item) {
                    $this->assertItemBelongsToMerchant($merchant->id, $item['item_type'], (int) $item['item_id']);
                    SubscriptionPlanItem::create([
                        'subscription_plan_id' => $subscriptionPlan->id,
                        'item_type' => $item['item_type'],
                        'item_id' => $item['item_id'],
                        'unlock_after_days' => $item['unlock_after_days'] ?? 0,
                    ]);
                }
            }
        });

        $entitlementService->syncActiveSubscribersForPlan((int) $subscriptionPlan->id);
        $freshPlan = $subscriptionPlan->fresh(['items']);
        if ($freshPlan->status === 'active' && $this->shouldPublishToTakeer($validated)) {
            $this->syncFeedPostForActivePlan($freshPlan);
        } else {
            $this->deleteFeedPostForPlan($subscriptionPlan);
        }

        return response()->json([
            'message' => 'Subscription plan updated.',
            'subscription_plan' => $subscriptionPlan->fresh()->load('items'),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $this->deleteFeedPostForPlan($subscriptionPlan);
        $subscriptionPlan->delete();

        return response()->json(['message' => 'Subscription plan deleted.']);
    }

    public function members(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $members = UserSubscription::query()
            ->with('user:id,name,email,phone_number')
            ->where('subscription_plan_id', $subscriptionPlan->id)
            ->latest()
            ->get();

        return response()->json([
            'members' => $members->map(fn (UserSubscription $subscription) => $this->serializeMember($subscription))->values(),
            'stats' => [
                'total' => $members->count(),
                'active' => $members->filter(fn (UserSubscription $subscription) => $this->effectiveMemberStatus($subscription) === 'active')->count(),
                'paused' => $members->where('status', 'paused')->count(),
                'cancelled' => $members->filter(fn (UserSubscription $subscription) => in_array($this->effectiveMemberStatus($subscription), ['cancelled', 'expired'], true))->count(),
            ],
        ]);
    }

    public function merchantMembers(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

        $baseQuery = UserSubscription::query()
            ->where('merchant_id', $merchant->id);

        $members = UserSubscription::query()
            ->with(['user:id,name,email,phone_number', 'plan:id,name,price,billing_interval,interval_count'])
            ->where('merchant_id', $merchant->id)
            ->latest()
            ->take(200)
            ->get();

        return response()->json([
            'members' => $members->map(fn (UserSubscription $subscription) => $this->serializeMember($subscription))->values(),
            'stats' => [
                'total' => (clone $baseQuery)->count(),
                'active' => (clone $baseQuery)
                    ->where('status', 'active')
                    ->where(fn ($periodQuery) => $periodQuery
                        ->whereNull('current_period_end')
                        ->orWhere('current_period_end', '>', now()))
                    ->count(),
                'paused' => (clone $baseQuery)->where('status', 'paused')->count(),
                'cancelled' => (clone $baseQuery)
                    ->where(fn ($statusQuery) => $statusQuery
                        ->whereIn('status', ['cancelled', 'expired'])
                        ->orWhere(fn ($expiredQuery) => $expiredQuery
                            ->where('status', 'active')
                            ->whereNotNull('current_period_end')
                            ->where('current_period_end', '<=', now())))
                    ->count(),
            ],
        ]);
    }

    public function updateMember(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $userSubscription = $this->userSubscriptionFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);
        abort_unless((int) $userSubscription->subscription_plan_id === (int) $subscriptionPlan->id, 404);
        abort_unless((int) $userSubscription->merchant_id === (int) $merchant->id, 404);

        abort(403, 'Subscription access changes are handled by Takeer support to protect paid subscribers and escrow records.');
    }

    public function communityPosts(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $posts = $this->communityPostQuery($subscriptionPlan)
            ->latest('posts.created_at')
            ->take(30)
            ->get();

        return response()->json([
            'posts' => PostResource::collection($posts)->resolve($request),
            'count' => $posts->count(),
        ]);
    }

    public function storeCommunityPost(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:160'],
            'excerpt' => ['nullable', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:20000'],
            'caption' => ['nullable', 'string', 'max:2000'],
            'comments_enabled_override' => ['nullable', 'boolean'],
            'reactions_enabled_override' => ['nullable', 'boolean'],
        ]);

        $hasContent = collect(['title', 'excerpt', 'body', 'caption'])
            ->contains(fn (string $key) => trim((string) ($validated[$key] ?? '')) !== '');
        abort_unless($hasContent, 422, 'Write something for members before publishing.');

        $post = DB::transaction(function () use ($merchant, $subscriptionPlan, $validated) {
            $post = Post::query()->create([
                'merchant_id' => $merchant->id,
                'source' => 'member_community',
                'title' => $validated['title'] ?? null,
                'excerpt' => $validated['excerpt'] ?? null,
                'body' => $validated['body'] ?? null,
                'caption' => $validated['caption'] ?? null,
                'is_restricted' => true,
                'restricted_price' => null,
                'comments_enabled_override' => $validated['comments_enabled_override'] ?? null,
                'reactions_enabled_override' => $validated['reactions_enabled_override'] ?? null,
            ]);

            DB::table('post_promotables')->insert([
                'post_id' => $post->id,
                'promotable_type' => SubscriptionPlan::class,
                'promotable_id' => $subscriptionPlan->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $post;
        });

        $post = $this->communityPostQuery($subscriptionPlan)
            ->where('posts.id', $post->id)
            ->firstOrFail();

        return response()->json([
            'message' => 'Member post published.',
            'post' => PostResource::make($post)->resolve($request),
        ], 201);
    }

    public function destroyCommunityPost(Request $request): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $subscriptionPlan = $this->subscriptionPlanFromRequest($request);
        $post = $this->postFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);
        abort_unless((int) $post->merchant_id === (int) $merchant->id, 404);

        $belongsToPlan = DB::table('post_promotables')
            ->where('post_id', $post->id)
            ->where('promotable_type', SubscriptionPlan::class)
            ->where('promotable_id', $subscriptionPlan->id)
            ->exists();
        abort_unless($belongsToPlan, 404);

        $post->update([
            'comments_enabled_override' => false,
            'reactions_enabled_override' => false,
        ]);
        $post->delete();

        return response()->json(['message' => 'Member post removed.']);
    }

    private function validatePlanSchedule(array $data): void
    {
        $interval = $data['billing_interval'] ?? 'monthly';

        if ($interval === 'weekly' && empty($data['weekly_days'])) {
            abort(422, 'weekly_days is required for weekly billing.');
        }

        if ($interval === 'monthly' && isset($data['monthly_day']) && ((int) $data['monthly_day'] < 1 || (int) $data['monthly_day'] > 28)) {
            abort(422, 'monthly_day must be between 1 and 28.');
        }
    }

    private function shouldPublishToTakeer(array $validated): bool
    {
        $targets = (array) ($validated['publish_targets'] ?? []);

        return ! array_key_exists('takeer', $targets)
            || filter_var($targets['takeer'], FILTER_VALIDATE_BOOLEAN);
    }

    private function syncFeedPostForActivePlan(SubscriptionPlan $subscriptionPlan): void
    {
        if ($subscriptionPlan->status !== 'active') {
            return;
        }

        $subscriptionPlan->loadMissing('items');

        $existingFeedPost = Post::query()
            ->where('merchant_id', $subscriptionPlan->merchant_id)
            ->whereHas('promotableSubscriptions', fn ($query) => $query->where('subscription_plans.id', $subscriptionPlan->id))
            ->where('source', 'subscription_plan_publish')
            ->first();

        $captionLines = array_filter([
            $subscriptionPlan->name,
            trim((string) ($subscriptionPlan->description ?? '')),
        ]);

        $post = $existingFeedPost ?: new Post([
            'merchant_id' => $subscriptionPlan->merchant_id,
            'source' => 'subscription_plan_publish',
        ]);

        $post->fill([
            'title' => $subscriptionPlan->name,
            'source' => 'subscription_plan_publish',
            'excerpt' => trim((string) ($subscriptionPlan->description ?? '')),
            'caption' => implode("\n\n", $captionLines),
            'is_restricted' => true,
            'restricted_price' => null,
            'bg_style' => $existingFeedPost?->bg_style,
        ]);
        $post->save();
        $post->promotableSubscriptions()->syncWithoutDetaching([$subscriptionPlan->id]);
    }

    private function deleteFeedPostForPlan(SubscriptionPlan $subscriptionPlan): void
    {
        Post::query()
            ->where('merchant_id', $subscriptionPlan->merchant_id)
            ->where('source', 'subscription_plan_publish')
            ->whereHas('promotableSubscriptions', fn ($query) => $query->where('subscription_plans.id', $subscriptionPlan->id))
            ->get()
            ->each
            ->delete();
    }

    private function communityPostQuery(SubscriptionPlan $subscriptionPlan)
    {
        return Post::query()
            ->with([
                'merchant.storefrontSetting',
                'linkPreview',
                'linkedContentItem',
                'media.productImage',
                'productTags.product.attributes',
                'productTags.product.images',
                'productTags.product.variants',
                'reactions',
                'promotableSubscriptions',
            ])
            ->whereHas('promotableSubscriptions', fn ($query) => $query->whereKey($subscriptionPlan->id));
    }

    private function assertItemBelongsToMerchant(int $merchantId, string $itemType, int $itemId): void
    {
        if ($itemType === 'content_item') {
            $exists = ContentItem::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Plan item content is invalid.');
            return;
        }

        if ($itemType === 'bundle') {
            $exists = Bundle::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Plan item bundle is invalid.');
            abort_if($this->bundleContainsPhysicalProducts($itemId), 422, 'Subscription bundles cannot include physical products.');
            return;
        }

        if ($itemType === 'product') {
            $exists = Product::where('id', $itemId)
                ->where('merchant_id', $merchantId)
                ->where('type', 'digital')
                ->exists();
            abort_unless($exists, 422, 'Subscription product is invalid.');
            return;
        }

        abort(422, 'Subscriptions can include content, digital products, and digital/course bundles only.');
    }

    private function bundleContainsPhysicalProducts(int $bundleId): bool
    {
        return DB::table('bundle_items')
            ->join('products', 'products.id', '=', 'bundle_items.item_id')
            ->where('bundle_items.bundle_id', $bundleId)
            ->where('bundle_items.item_type', 'product')
            ->where('products.type', 'physical')
            ->exists();
    }

    private function merchantFromRequest(Request $request)
    {
        $routeMerchant = $request->route('merchant');
        if ($routeMerchant instanceof Merchant) {
            return $routeMerchant;
        }

        $user = $request->user();
        if ($routeMerchant) {
            $merchant = \App\Support\MerchantPermissions::accessibleMerchantsFor($user)
                ->first(fn ($merchant) => $merchant->username === $routeMerchant || (is_numeric($routeMerchant) && (int) $merchant->id === (int) $routeMerchant));

            if ($merchant) {
                return $merchant;
            }
        }

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

    private function subscriptionPlanFromRequest(Request $request): SubscriptionPlan
    {
        $routePlan = $request->route('subscriptionPlan') ?? $request->route('plan');

        if ($routePlan instanceof SubscriptionPlan) {
            return $routePlan;
        }

        return SubscriptionPlan::query()->findOrFail($routePlan);
    }

    private function userSubscriptionFromRequest(Request $request): UserSubscription
    {
        $routeSubscription = $request->route('userSubscription');

        if ($routeSubscription instanceof UserSubscription) {
            return $routeSubscription;
        }

        return UserSubscription::query()->findOrFail($routeSubscription);
    }

    private function postFromRequest(Request $request): Post
    {
        $routePost = $request->route('post');

        if ($routePost instanceof Post) {
            return $routePost;
        }

        return Post::query()->findOrFail($routePost);
    }

    private function ensureOwnership(int $merchantId, int $planMerchantId): void
    {
        abort_if($merchantId !== $planMerchantId, 403, 'Unauthorized.');
    }

    private function serializeMember(UserSubscription $subscription): array
    {
        $effectiveStatus = $this->effectiveMemberStatus($subscription);

        return [
            'id' => $subscription->id,
            'status' => $effectiveStatus,
            'raw_status' => $subscription->status,
            'auto_renew' => (bool) $subscription->auto_renew,
            'started_at' => $subscription->started_at?->toISOString(),
            'current_period_start' => $subscription->current_period_start?->toISOString(),
            'current_period_end' => $subscription->current_period_end?->toISOString(),
            'next_billing_at' => $subscription->next_billing_at?->toISOString(),
            'cancelled_at' => $subscription->cancelled_at?->toISOString(),
            'ended_at' => $subscription->ended_at?->toISOString(),
            'user' => $subscription->user ? [
                'id' => $subscription->user->id,
                'name' => $subscription->user->name,
                'email' => $subscription->user->email,
                'phone_number' => $subscription->user->phone_number,
            ] : null,
            'plan' => $subscription->plan ? [
                'id' => $subscription->plan->id,
                'name' => $subscription->plan->name,
                'price' => (float) $subscription->plan->price,
                'billing_interval' => $subscription->plan->billing_interval,
                'interval_count' => (int) ($subscription->plan->interval_count ?? 1),
            ] : null,
        ];
    }

    private function effectiveMemberStatus(UserSubscription $subscription): string
    {
        if (
            $subscription->status === 'active'
            && $subscription->current_period_end
            && $subscription->current_period_end->isPast()
        ) {
            return 'expired';
        }

        return $subscription->status;
    }
}
