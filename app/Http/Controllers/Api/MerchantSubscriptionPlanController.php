<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\SubscriptionPlanItem;
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
            ->orderBy('tier')
            ->latest()
            ->get();

        return response()->json(['plans' => $plans]);
    }

    public function show(Request $request, SubscriptionPlan $subscriptionPlan): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $subscriptionPlan->load('items');

        return response()->json(['subscription_plan' => $subscriptionPlan]);
    }

    public function store(Request $request, EntitlementService $entitlementService): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);

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
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:product,content_item,bundle',
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

        return response()->json([
            'message' => 'Subscription plan created.',
            'subscription_plan' => $plan->load('items'),
        ], 201);
    }

    public function update(Request $request, SubscriptionPlan $subscriptionPlan, EntitlementService $entitlementService): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
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
            'items' => 'nullable|array',
            'items.*.item_type' => 'required_with:items|string|in:product,content_item,bundle',
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
                ...collect($validated)->except(['items'])->toArray(),
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

        return response()->json([
            'message' => 'Subscription plan updated.',
            'subscription_plan' => $subscriptionPlan->fresh()->load('items'),
        ]);
    }

    public function destroy(Request $request, SubscriptionPlan $subscriptionPlan): JsonResponse
    {
        $merchant = $this->merchantFromRequest($request);
        $this->ensureOwnership($merchant->id, $subscriptionPlan->merchant_id);

        $subscriptionPlan->delete();

        return response()->json(['message' => 'Subscription plan deleted.']);
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

    private function assertItemBelongsToMerchant(int $merchantId, string $itemType, int $itemId): void
    {
        if ($itemType === 'product') {
            $exists = Product::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Plan item product is invalid.');
            return;
        }

        if ($itemType === 'content_item') {
            $exists = ContentItem::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Plan item content is invalid.');
            return;
        }

        if ($itemType === 'bundle') {
            $exists = Bundle::where('id', $itemId)->where('merchant_id', $merchantId)->exists();
            abort_unless($exists, 422, 'Plan item bundle is invalid.');
            return;
        }

        abort(422, 'Unsupported plan item type.');
    }

    private function merchantFromRequest(Request $request)
    {
        $merchant = $request->user()
            ->merchantProfiles()
            ->where('is_default', true)
            ->first() ?? $request->user()->merchantProfiles()->first();

        abort_unless($merchant, 403, 'Merchant profile not found.');

        return $merchant;
    }

    private function ensureOwnership(int $merchantId, int $planMerchantId): void
    {
        abort_if($merchantId !== $planMerchantId, 403, 'Unauthorized.');
    }
}
