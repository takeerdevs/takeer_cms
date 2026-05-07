<?php

namespace App\Services;

use App\Models\Delivery;
use App\Models\Entitlement;
use App\Models\Order;
use App\Models\ProductReview;
use App\Models\PulseNotification;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use Illuminate\Database\Eloquent\Model;

class PulseNotificationService
{
    public function orderCreated(Order $order): void
    {
        $order->loadMissing(['product', 'merchant.user']);
        if (!$order->buyer_id) {
            return;
        }

        $this->record([
            'user_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'subject' => $order,
            'event_type' => 'order_started',
            'dedupe_key' => "order-started:{$order->id}",
            'icon' => 'shopping_bag',
            'tone' => $order->requiresPhysicalFulfillment() ? 'amber' : 'sky',
            'eyebrow' => 'Order started',
            'title' => $this->orderTitle($order),
            'body' => $order->payment_status === 'pending'
                ? 'Your order has started. Complete payment or wait for the merchant quote if delivery needs confirmation.'
                : 'Your order has been placed successfully.',
            'meta' => $this->merchantName($order),
            'href' => $this->orderHref($order),
            'status' => $order->payment_status,
            'occurred_at' => $order->created_at ?: now(),
        ]);

        $this->recordMerchantOrderEvent($order, [
            'event_type' => 'merchant_order_started',
            'dedupe_key' => "merchant-order-started:{$order->id}",
            'icon' => 'shopping_bag',
            'tone' => $order->requiresPhysicalFulfillment() ? 'amber' : 'sky',
            'eyebrow' => 'New order',
            'body' => "A customer placed an order for {$this->orderTitle($order)}.",
            'status' => $order->payment_status,
            'occurred_at' => $order->created_at ?: now(),
        ]);
    }

    public function backfillOrder(Order $order): void
    {
        $order->loadMissing(['product', 'merchant', 'delivery']);
        $this->orderCreated($order);

        if (in_array($order->payment_status, ['resolved_merchant_paid', 'escrow_locked', 'awaiting_merchant_confirmation', 'disputed', 'failed'], true)) {
            $this->paymentStatusChanged($order);
        }

        if ($order->first_downloaded_at) {
            $this->record([
                'user_id' => $order->buyer_id,
                'merchant_id' => $order->merchant_id,
                'subject' => $order,
                'event_type' => 'digital_access_used',
                'dedupe_key' => "digital-access-used:{$order->id}",
                'icon' => 'download',
                'tone' => 'emerald',
                'eyebrow' => 'Access used',
                'title' => $this->orderTitle($order),
                'body' => 'This digital item was opened from your Library.',
                'meta' => $this->merchantName($order),
                'href' => '/orders',
                'status' => 'accessed',
                'occurred_at' => $order->first_downloaded_at,
            ]);
        }

        if ($order->custom_delivery_delivered_at) {
            $this->customDelivery($order, 'custom_delivery_ready', 'Custom delivery ready', $order->custom_delivery_message ?: 'Merchant delivered your custom work. Review it from your Library.', 'sparkles', 'violet', 'delivered', $order->custom_delivery_delivered_at);
        }

        if ($order->custom_delivery_revision_requested_at) {
            $this->customDelivery($order, 'custom_delivery_revision_requested', 'Revision requested', $order->custom_delivery_revision_message ?: 'A revision was requested for this custom order.', 'refresh', 'amber', 'revision_requested', $order->custom_delivery_revision_requested_at);
        }

        if ($order->custom_delivery_accepted_at) {
            $this->customDelivery($order, 'custom_delivery_accepted', 'Custom work accepted', 'This custom order was accepted and completed.', 'check', 'emerald', 'accepted', $order->custom_delivery_accepted_at);
        }
    }

    public function orderUpdated(Order $order): void
    {
        $order->loadMissing(['product', 'merchant']);
        if (!$order->buyer_id) {
            return;
        }

        if ($order->wasChanged('shipping_fee') || $order->wasChanged('total_paid') || $order->wasChanged('inquiry_status')) {
            if ($order->is_inquiry && $order->inquiry_status === 'quoted') {
                $amount = number_format((float) $order->total_paid);
                $shipping = number_format((float) $order->shipping_fee);
                $this->record([
                    'user_id' => $order->buyer_id,
                    'merchant_id' => $order->merchant_id,
                    'subject' => $order,
                    'event_type' => 'order_quote_updated',
                    'dedupe_key' => "order-quote:{$order->id}:{$order->updated_at?->timestamp}",
                    'icon' => 'receipt',
                    'tone' => 'amber',
                    'eyebrow' => 'Quote updated',
                    'title' => $this->orderTitle($order),
                    'body' => "Merchant updated this order. Shipping fee: TZS {$shipping}. New total: TZS {$amount}.",
                    'meta' => $this->merchantName($order),
                    'href' => $this->orderHref($order),
                    'status' => $order->inquiry_status,
                    'occurred_at' => $order->updated_at ?: now(),
                ]);
                $this->recordMerchantOrderEvent($order, [
                    'event_type' => 'merchant_order_quote_updated',
                    'dedupe_key' => "merchant-order-quote:{$order->id}:{$order->updated_at?->timestamp}",
                    'icon' => 'receipt',
                    'tone' => 'amber',
                    'eyebrow' => 'Quote sent',
                    'body' => "You updated shipping/total for {$this->orderTitle($order)}. Shipping: TZS {$shipping}. Total: TZS {$amount}.",
                    'status' => $order->inquiry_status,
                    'occurred_at' => $order->updated_at ?: now(),
                ]);
            }
        }

        if ($order->wasChanged('payment_status')) {
            $this->paymentStatusChanged($order);
        }

        if ($order->wasChanged('first_downloaded_at') && $order->first_downloaded_at) {
            $this->record([
                'user_id' => $order->buyer_id,
                'merchant_id' => $order->merchant_id,
                'subject' => $order,
                'event_type' => 'digital_access_used',
                'dedupe_key' => "digital-access-used:{$order->id}",
                'icon' => 'download',
                'tone' => 'emerald',
                'eyebrow' => 'Access used',
                'title' => $this->orderTitle($order),
                'body' => 'This digital item was opened from your Library.',
                'meta' => $this->merchantName($order),
                'href' => '/orders',
                'status' => 'accessed',
                'occurred_at' => $order->first_downloaded_at,
            ]);
        }

        if ($order->wasChanged('custom_delivery_delivered_at') && $order->custom_delivery_delivered_at) {
            $this->customDelivery($order, 'custom_delivery_ready', 'Custom delivery ready', $order->custom_delivery_message ?: 'Merchant delivered your custom work. Review it from your Library.', 'sparkles', 'violet', 'delivered', $order->custom_delivery_delivered_at);
        }

        if ($order->wasChanged('custom_delivery_revision_requested_at') && $order->custom_delivery_revision_requested_at) {
            $this->customDelivery($order, 'custom_delivery_revision_requested', 'Revision requested', $order->custom_delivery_revision_message ?: 'A revision was requested for this custom order.', 'refresh', 'amber', 'revision_requested', $order->custom_delivery_revision_requested_at);
        }

        if ($order->wasChanged('custom_delivery_accepted_at') && $order->custom_delivery_accepted_at) {
            $this->customDelivery($order, 'custom_delivery_accepted', 'Custom work accepted', 'This custom order was accepted and completed.', 'check', 'emerald', 'accepted', $order->custom_delivery_accepted_at);
        }
    }

    public function deliveryUpdated(Delivery $delivery): void
    {
        $delivery->loadMissing(['order.product', 'order.merchant']);
        $order = $delivery->order;
        if (!$order?->buyer_id) {
            return;
        }

        if ($delivery->wasChanged('pickup_pin') && $delivery->pickup_pin) {
            $this->record([
                'user_id' => $order->buyer_id,
                'merchant_id' => $order->merchant_id,
                'subject' => $order,
                'event_type' => 'pickup_pin_ready',
                'dedupe_key' => "pickup-pin-ready:{$order->id}",
                'icon' => 'key',
                'tone' => 'amber',
                'eyebrow' => 'Pickup PIN ready',
                'title' => $this->orderTitle($order),
                'body' => 'Pickup PIN is ready. Share it only after receiving and inspecting the item.',
                'meta' => $this->merchantName($order),
                'href' => $this->orderHref($order),
                'status' => 'pickup_ready',
                'occurred_at' => $delivery->updated_at ?: now(),
            ]);
        }

        if ($delivery->wasChanged('delivery_status') || $delivery->wasChanged('waybill_tracking_number') || $delivery->wasChanged('bus_company')) {
            $tracking = $delivery->waybill_tracking_number ? " Tracking: {$delivery->waybill_tracking_number}." : '';
            $this->record([
                'user_id' => $order->buyer_id,
                'merchant_id' => $order->merchant_id,
                'subject' => $order,
                'event_type' => 'delivery_updated',
                'dedupe_key' => "delivery-updated:{$delivery->id}:{$delivery->updated_at?->timestamp}",
                'icon' => 'truck',
                'tone' => $delivery->delivery_status === 'delivered' ? 'emerald' : 'sky',
                'eyebrow' => 'Delivery update',
                'title' => $this->orderTitle($order),
                'body' => trim($this->humanStatus($delivery->delivery_status ?: 'Delivery updated').'.'.$tracking),
                'meta' => $this->merchantName($order),
                'href' => $this->orderHref($order),
                'status' => $delivery->delivery_status,
                'occurred_at' => $delivery->updated_at ?: now(),
            ]);
        }
    }

    public function subscriptionStarted(UserSubscription $subscription): void
    {
        $subscription->loadMissing(['plan', 'merchant']);
        $this->record([
            'user_id' => $subscription->user_id,
            'merchant_id' => $subscription->merchant_id,
            'subject' => $subscription,
            'event_type' => 'membership_started',
            'dedupe_key' => "membership-started:{$subscription->id}",
            'icon' => 'crown',
            'tone' => 'emerald',
            'eyebrow' => 'Membership started',
            'title' => $subscription->plan?->name ?: 'Membership plan',
            'body' => $subscription->current_period_end
                ? 'Membership access is active until '.$subscription->current_period_end->format('M j, Y').'.'
                : 'Membership access is active.',
            'meta' => $subscription->merchant?->display_name ?: 'Takeer merchant',
            'href' => $this->planHref($subscription->plan),
            'status' => $subscription->status,
            'occurred_at' => $subscription->started_at ?: $subscription->created_at ?: now(),
        ]);
    }

    public function subscriptionContentAdded(Entitlement $entitlement): void
    {
        if ($entitlement->source_type !== 'subscription' || !$entitlement->source_id) {
            return;
        }

        $subscription = UserSubscription::with(['plan', 'merchant'])->find($entitlement->source_id);
        if (!$subscription) {
            return;
        }

        $title = $this->entitledTitle($entitlement);
        $planName = $subscription->plan?->name ?: 'your subscription';
        $this->record([
            'user_id' => $entitlement->user_id,
            'merchant_id' => $entitlement->merchant_id,
            'subject' => $entitlement,
            'event_type' => 'membership_content_added',
            'dedupe_key' => "membership-content:{$subscription->id}:{$entitlement->item_type}:{$entitlement->item_id}",
            'icon' => 'library',
            'tone' => 'emerald',
            'eyebrow' => 'New membership content',
            'title' => $title,
            'body' => "{$title} has been added to {$planName}. You can access it now in Library.",
            'meta' => $subscription->merchant?->display_name ?: 'Takeer merchant',
            'href' => '/orders',
            'status' => 'available',
            'occurred_at' => now(),
        ]);
    }

    public function reviewCreated(ProductReview $review): void
    {
        $review->loadMissing(['product.merchant.user', 'user', 'order']);
        $merchant = $review->product?->merchant;
        if (!$merchant?->user_id) {
            return;
        }

        $stars = (int) $review->rating;
        $comment = trim((string) $review->comment);
        $customer = $review->user?->name ?: 'Customer';
        $title = $review->product?->title ?: 'Product review';

        $this->record([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'subject' => $review,
            'event_type' => 'merchant_review_created',
            'dedupe_key' => "merchant-review:{$review->id}",
            'icon' => 'star',
            'tone' => $stars >= 4 ? 'emerald' : ($stars <= 2 ? 'rose' : 'amber'),
            'eyebrow' => "{$stars} star review",
            'title' => $title,
            'body' => $comment !== '' ? "{$customer}: \"{$comment}\"" : "{$customer} left a {$stars} star review.",
            'meta' => $customer,
            'href' => $review->order_id ? "/chat/".($review->order?->public_id ?: $review->order_id)."?acting_as=merchant" : null,
            'status' => 'review',
            'payload' => [
                'rating' => $stars,
                'comment' => $comment,
                'customer' => $customer,
            ],
            'occurred_at' => $review->created_at ?: now(),
        ]);
    }

    private function paymentStatusChanged(Order $order): void
    {
        $earned = number_format((float) $order->total_paid);
        $event = match ($order->payment_status) {
            'resolved_merchant_paid' => [
                'payment_completed',
                'Payment completed',
                $order->requiresPhysicalFulfillment() ? 'Order completed and merchant has been paid.' : 'Payment completed. Access is available in your Library.',
                "Payment completed. You earned TZS {$earned} from this order.",
                'shield_check',
                'emerald',
            ],
            'escrow_locked' => [
                'payment_held',
                'Payment protected',
                'Payment is protected while this order is being fulfilled.',
                'Customer payment is protected in escrow while this order is being fulfilled.',
                'shield_check',
                'amber',
            ],
            'awaiting_merchant_confirmation' => [
                'merchant_confirmation_needed',
                'Waiting for merchant',
                'Payment is complete. Merchant needs to confirm and prepare the order.',
                'Payment is complete. Confirm and prepare this order.',
                'shield_check',
                'amber',
            ],
            'disputed' => [
                'issue_reported',
                'Issue reported',
                'A claim or dispute was opened for this order.',
                'A claim or dispute was opened for this order.',
                'alert',
                'rose',
            ],
            'failed' => [
                'order_cancelled',
                'Order cancelled',
                'This order was cancelled or payment failed.',
                'This order was cancelled or payment failed.',
                'alert',
                'slate',
            ],
            default => null,
        };

        if (!$event) {
            return;
        }

        [$type, $eyebrow, $body, $merchantBody, $icon, $tone] = $event;
        $this->record([
            'user_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'subject' => $order,
            'event_type' => $type,
            'dedupe_key' => "{$type}:{$order->id}:{$order->payment_status}",
            'icon' => $icon,
            'tone' => $tone,
            'eyebrow' => $eyebrow,
            'title' => $this->orderTitle($order),
            'body' => $body,
            'meta' => $this->merchantName($order),
            'href' => $this->orderHref($order),
            'status' => $order->payment_status,
            'occurred_at' => $order->updated_at ?: now(),
        ]);

        $this->recordMerchantOrderEvent($order, [
            'event_type' => "merchant_{$type}",
            'dedupe_key' => "merchant-{$type}:{$order->id}:{$order->payment_status}",
            'icon' => $icon,
            'tone' => $tone,
            'eyebrow' => $eyebrow,
            'body' => $merchantBody,
            'status' => $order->payment_status,
            'payload' => [
                'earned' => (float) $order->total_paid,
                'currency' => 'TZS',
            ],
            'occurred_at' => $order->updated_at ?: now(),
        ]);
    }

    private function recordMerchantOrderEvent(Order $order, array $data): void
    {
        $order->loadMissing(['merchant.user', 'product', 'buyer']);
        if (!$order->merchant?->user_id) {
            return;
        }

        $this->record([
            'user_id' => $order->merchant->user_id,
            'merchant_id' => $order->merchant_id,
            'subject' => $order,
            'title' => $this->orderTitle($order),
            'meta' => $order->buyer?->name ?: $order->customer_name ?: 'Customer',
            'href' => $order->public_id ? "/chat/{$order->public_id}?acting_as=merchant" : "/merchant/{$order->merchant->username}/orders",
            ...$data,
        ]);
    }

    private function customDelivery(Order $order, string $type, string $eyebrow, string $body, string $icon, string $tone, string $status, $occurredAt): void
    {
        $this->record([
            'user_id' => $order->buyer_id,
            'merchant_id' => $order->merchant_id,
            'subject' => $order,
            'event_type' => $type,
            'dedupe_key' => "{$type}:{$order->id}",
            'icon' => $icon,
            'tone' => $tone,
            'eyebrow' => $eyebrow,
            'title' => $this->orderTitle($order),
            'body' => $body,
            'meta' => $this->merchantName($order),
            'href' => $this->orderHref($order),
            'status' => $status,
            'occurred_at' => $occurredAt ?: now(),
        ]);
    }

    private function record(array $data): void
    {
        $subject = $data['subject'] ?? null;
        unset($data['subject']);

        if ($subject instanceof Model) {
            $data['subject_type'] = $subject->getMorphClass();
            $data['subject_id'] = $subject->getKey();
        }

        PulseNotification::query()->updateOrCreate(
            ['dedupe_key' => $data['dedupe_key']],
            $data
        );
    }

    private function orderTitle(Order $order): string
    {
        return $order->product?->title ?: 'Order #'.($order->public_id ?: $order->id);
    }

    private function merchantName(Order $order): string
    {
        return $order->merchant?->display_name ?: 'Takeer merchant';
    }

    private function orderHref(Order $order): string
    {
        return $order->public_id ? "/chat/{$order->public_id}" : '/orders';
    }

    private function planHref(?SubscriptionPlan $plan): string
    {
        return $plan ? "/plan/".($plan->slug ?: $plan->id) : '/orders';
    }

    private function humanStatus(string $status): string
    {
        return ucfirst(str_replace('_', ' ', $status));
    }

    private function entitledTitle(Entitlement $entitlement): string
    {
        $model = match ($entitlement->item_type) {
            'product' => \App\Models\Product::query()->find($entitlement->item_id),
            'content_item' => \App\Models\ContentItem::withTrashed()->find($entitlement->item_id),
            'bundle' => \App\Models\Bundle::query()->find($entitlement->item_id),
            'post' => \App\Models\Post::withTrashed()->find($entitlement->item_id),
            default => null,
        };

        return (string) ($model?->title ?? $model?->name ?? 'New content');
    }
}
