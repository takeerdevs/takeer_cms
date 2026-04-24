<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    public function subscribe(Request $request, SubscriptionPlan $subscriptionPlan, EntitlementService $entitlementService): JsonResponse
    {
        abort_if($subscriptionPlan->status !== 'active', 422, 'Subscription plan is not active.');
        abort_if((float) $subscriptionPlan->price > 0, 422, 'Paid plans must be purchased through checkout.');

        $existingActive = UserSubscription::where('user_id', $request->user()->id)
            ->where('subscription_plan_id', $subscriptionPlan->id)
            ->whereIn('status', ['pending', 'active', 'past_due'])
            ->exists();

        abort_if($existingActive, 422, 'You already have an active subscription for this plan.');

        $subscription = DB::transaction(function () use ($request, $subscriptionPlan) {
            $periodStart = now();
            $periodEnd = $this->calculatePeriodEnd(
                $subscriptionPlan->billing_interval,
                (int) ($subscriptionPlan->interval_count ?? 1)
            );

            return UserSubscription::create([
                'user_id' => $request->user()->id,
                'merchant_id' => $subscriptionPlan->merchant_id,
                'subscription_plan_id' => $subscriptionPlan->id,
                'status' => 'active',
                'auto_renew' => true,
                'started_at' => $periodStart,
                'current_period_start' => $periodStart,
                'current_period_end' => $periodEnd,
                'next_billing_at' => $periodEnd,
            ]);
        });

        $entitlementService->grantForSubscription($subscription);

        return response()->json([
            'message' => 'Subscription activated.',
            'subscription' => $subscription->load('plan'),
        ], 201);
    }

    public function mySubscriptions(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $subscriptions = UserSubscription::where('user_id', $request->user()->id)
            ->with(['plan', 'merchant'])
            ->latest()
            ->paginate($perPage);

        return response()->json($subscriptions);
    }

    public function cancel(Request $request, UserSubscription $userSubscription): JsonResponse
    {
        abort_if($userSubscription->user_id !== $request->user()->id, 403, 'Unauthorized.');

        $userSubscription->update([
            'status' => 'cancelled',
            'auto_renew' => false,
            'cancelled_at' => now(),
            'ended_at' => $userSubscription->current_period_end,
        ]);

        return response()->json([
            'message' => 'Subscription cancelled.',
            'subscription' => $userSubscription->fresh(),
        ]);
    }

    private function calculatePeriodEnd(string $interval, int $count)
    {
        return match ($interval) {
            'hourly' => now()->addHours($count),
            'daily' => now()->addDays($count),
            'weekly' => now()->addWeeks($count),
            default => now()->addMonths($count),
        };
    }
}
