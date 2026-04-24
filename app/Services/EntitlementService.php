<?php

namespace App\Services;

use App\Models\Bundle;
use App\Models\BundleItem;
use App\Models\Entitlement;
use App\Models\Order;
use App\Models\SubscriptionPlanItem;
use App\Models\UserSubscription;

class EntitlementService
{
    public function grantForOrder(Order $order): void
    {
        $type = $order->purchasable_type ?? ($order->product_id ? 'product' : null);
        $id = $order->purchasable_id ?? $order->product_id;
        $bundleSelection = collect($order->bundle_item_selection ?? [])
            ->filter(fn ($item) => in_array(($item['item_type'] ?? null), ['product', 'content_item'], true) && (int) ($item['item_id'] ?? 0) > 0)
            ->values();

        if (!$type || !$id) {
            return;
        }

        $isMenuSelectionBundle = $type === 'bundle' && $bundleSelection->isNotEmpty();
        if (!$isMenuSelectionBundle) {
            $this->grantSingle(
                userId: $order->buyer_id,
                merchantId: $order->merchant_id ?? $order->product?->merchant_id,
                itemType: $type,
                itemId: $id,
                sourceType: 'order',
                sourceId: $order->id
            );
        }

        if ($type === 'bundle') {
            if ($bundleSelection->isNotEmpty()) {
                foreach ($bundleSelection as $item) {
                    $this->grantSingle(
                        userId: $order->buyer_id,
                        merchantId: (int) ($order->merchant_id ?? 0),
                        itemType: (string) $item['item_type'],
                        itemId: (int) $item['item_id'],
                        sourceType: 'order',
                        sourceId: $order->id
                    );
                }
                return;
            }
            $this->grantBundleItems($order->buyer_id, (int) ($order->merchant_id ?? 0), (int) $id, 'bundle', $order->id);
        }
    }

    public function grantForSubscription(UserSubscription $subscription): void
    {
        $items = SubscriptionPlanItem::where('subscription_plan_id', $subscription->subscription_plan_id)->get();

        foreach ($items as $item) {
            $this->grantSingle(
                userId: $subscription->user_id,
                merchantId: $subscription->merchant_id,
                itemType: $item->item_type,
                itemId: $item->item_id,
                sourceType: 'subscription',
                sourceId: $subscription->id,
                startsAt: now()->addDays($item->unlock_after_days),
                expiresAt: $subscription->current_period_end
            );

            if ($item->item_type === 'bundle') {
                $this->grantBundleItems(
                    userId: $subscription->user_id,
                    merchantId: $subscription->merchant_id,
                    bundleId: $item->item_id,
                    sourceType: 'subscription',
                    sourceId: $subscription->id,
                    startsAt: now()->addDays($item->unlock_after_days),
                    expiresAt: $subscription->current_period_end
                );
            }
        }
    }

    public function hasAccess(int $userId, string $itemType, int $itemId): bool
    {
        return Entitlement::where('user_id', $userId)
            ->where('item_type', $itemType)
            ->where('item_id', $itemId)
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->exists();
    }

    /**
     * Ensure all currently active subscribers of a plan receive all plan items,
     * including items added after they originally subscribed.
     */
    public function syncActiveSubscribersForPlan(int $planId): void
    {
        $activeSubscriptions = UserSubscription::where('subscription_plan_id', $planId)
            ->whereIn('status', ['pending', 'active', 'past_due'])
            ->where(function ($query) {
                $query->whereNull('ended_at')->orWhere('ended_at', '>', now());
            })
            ->get();

        foreach ($activeSubscriptions as $subscription) {
            $this->grantForSubscription($subscription);
        }
    }

    /**
     * Ensure all users who currently own a bundle (via order/subscription/etc.)
     * receive any newly added bundle items in their library.
     */
    public function syncActiveEntitlementsForBundle(int $bundleId): void
    {
        $bundle = Bundle::find($bundleId);
        if (!$bundle) {
            return;
        }

        $bundleItems = BundleItem::where('bundle_id', $bundleId)->get();
        if ($bundleItems->isEmpty()) {
            return;
        }

        $activeBundleOwners = Entitlement::where('item_type', 'bundle')
            ->where('item_id', $bundleId)
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($query) {
                $query->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->get();

        foreach ($activeBundleOwners as $owner) {
            foreach ($bundleItems as $item) {
                $this->grantSingle(
                    userId: (int) $owner->user_id,
                    merchantId: (int) ($owner->merchant_id ?: $bundle->merchant_id),
                    itemType: $item->item_type,
                    itemId: (int) $item->item_id,
                    sourceType: (string) $owner->source_type,
                    sourceId: $owner->source_id,
                    startsAt: $owner->starts_at,
                    expiresAt: $owner->expires_at
                );
            }
        }
    }

    private function grantSingle(
        int $userId,
        ?int $merchantId,
        string $itemType,
        int $itemId,
        string $sourceType,
        ?int $sourceId,
        $startsAt = null,
        $expiresAt = null
    ): void {
        if (!$merchantId) {
            return;
        }

        Entitlement::updateOrCreate(
            [
                'user_id' => $userId,
                'item_type' => $itemType,
                'item_id' => $itemId,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
            ],
            [
                'merchant_id' => $merchantId,
                'status' => 'active',
                'starts_at' => $startsAt,
                'expires_at' => $expiresAt,
                'revoked_at' => null,
            ]
        );
    }

    private function grantBundleItems(
        int $userId,
        int $merchantId,
        int $bundleId,
        string $sourceType,
        ?int $sourceId,
        $startsAt = null,
        $expiresAt = null
    ): void {
        $bundle = Bundle::find($bundleId);
        if (!$bundle) {
            return;
        }

        $resolvedMerchantId = $merchantId ?: $bundle->merchant_id;
        $items = BundleItem::where('bundle_id', $bundleId)->get();
        foreach ($items as $item) {
            $this->grantSingle(
                userId: $userId,
                merchantId: $resolvedMerchantId,
                itemType: $item->item_type,
                itemId: $item->item_id,
                sourceType: $sourceType,
                sourceId: $sourceId,
                startsAt: $startsAt,
                expiresAt: $expiresAt
            );
        }
    }
}
