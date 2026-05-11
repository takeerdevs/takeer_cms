<?php

namespace App\Services;

use App\Models\Order;
use App\Models\SubscriptionInvoice;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class SubscriptionRenewalService
{
    public function createOrExtendFromOrder(Order $order): UserSubscription
    {
        $plan = $order->resolved_purchasable;
        abort_unless($plan instanceof SubscriptionPlan, 422, 'Subscription plan not found.');

        return DB::transaction(function () use ($order, $plan) {
            $subscription = $this->activeSubscriptionFor((int) $order->buyer_id, (int) $plan->id);
            $periodStart = $this->renewalStart($subscription);
            $periodEnd = $this->calculatePeriodEnd($plan, $periodStart);

            if ($subscription) {
                $subscription->update([
                    'merchant_id' => $order->merchant_id,
                    'status' => 'active',
                    'auto_renew' => true,
                    'current_period_start' => $periodStart,
                    'current_period_end' => $periodEnd,
                    'next_billing_at' => $periodEnd,
                    'cancelled_at' => null,
                    'ended_at' => null,
                ]);
            } else {
                $subscription = UserSubscription::create([
                    'user_id' => $order->buyer_id,
                    'merchant_id' => $order->merchant_id,
                    'subscription_plan_id' => $plan->id,
                    'status' => 'active',
                    'auto_renew' => true,
                    'started_at' => now(),
                    'current_period_start' => $periodStart,
                    'current_period_end' => $periodEnd,
                    'next_billing_at' => $periodEnd,
                ]);
            }

            SubscriptionInvoice::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'user_subscription_id' => $subscription->id,
                    'amount' => $order->total_paid,
                    'status' => 'paid',
                    'billed_for_start' => $periodStart,
                    'billed_for_end' => $periodEnd,
                    'paid_at' => now(),
                    'reference' => 'SUB-' . $order->transaction_ref,
                ]
            );

            return $subscription->fresh();
        });
    }

    public function activeSubscriptionFor(int $userId, int $planId): ?UserSubscription
    {
        return UserSubscription::query()
            ->where('user_id', $userId)
            ->where('subscription_plan_id', $planId)
            ->whereIn('status', ['active', 'pending', 'past_due'])
            ->where(function ($query) {
                $query->whereNull('current_period_end')->orWhere('current_period_end', '>', now());
            })
            ->latest('current_period_end')
            ->latest('id')
            ->first();
    }

    private function renewalStart(?UserSubscription $subscription): Carbon
    {
        if ($subscription?->current_period_end && $subscription->current_period_end->isFuture()) {
            return $subscription->current_period_end->copy();
        }

        return now();
    }

    private function calculatePeriodEnd(SubscriptionPlan $plan, Carbon $start): Carbon
    {
        $count = max(1, (int) ($plan->interval_count ?? 1));

        return match ($plan->billing_interval) {
            'hourly' => $start->copy()->addHours($count),
            'daily' => $start->copy()->addDays($count),
            'weekly' => $start->copy()->addWeeks($count),
            default => $start->copy()->addMonths($count),
        };
    }
}
