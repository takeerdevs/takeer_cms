<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SocialCommerceRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $deliveryContext = $this->deliveryContext();
        $canViewExactDeliveryAddress = $request->user()
            && ((int) $this->buyer_id === (int) $request->user()->id
                || (int) $this->claimedMerchant?->user_id === (int) $request->user()->id
                || (bool) $request->user()->is_admin
                || $request->user()->role === 'admin');

        return [
            'public_id' => $this->public_id,
            'platform' => $this->platform,
            'original_url' => $this->original_url,
            'normalized_url' => $this->normalized_url,
            'external_post_id' => $this->external_post_id,
            'external_seller_handle' => $this->external_seller_handle,
            'external_seller_name' => $this->external_seller_name,
            'preview' => [
                'status' => $this->preview_status,
                'provenance' => $this->preview_provenance,
                'snapshot' => $this->preview_snapshot,
            ],
            'buyer_evidence' => [
                'available' => $canViewExactDeliveryAddress && filled($this->buyer_screenshot_path),
                'screenshot_url' => $canViewExactDeliveryAddress && filled($this->buyer_screenshot_path)
                    ? route('api.social-commerce.request.screenshot', ['socialRequest' => $this->public_id])
                    : null,
            ],
            'buyer_notes' => [
                'product' => $this->buyer_product_note,
                'variant' => $this->buyer_variant_note,
                'quantity' => (float) $this->requested_quantity,
                'observed_unit_price' => $this->observed_unit_price !== null ? (float) $this->observed_unit_price : null,
                'observed_currency_code' => $this->observed_currency_code,
            ],
            'destination' => [
                'summary' => $this->destination_summary,
                'preferred_delivery_type' => $this->preferred_delivery_type,
                'address' => $canViewExactDeliveryAddress ? ($deliveryContext['address_line'] ?? null) : null,
                'extra_details' => $canViewExactDeliveryAddress ? ($deliveryContext['extra_details'] ?? null) : null,
                'latitude' => $canViewExactDeliveryAddress ? ($deliveryContext['latitude'] ?? null) : null,
                'longitude' => $canViewExactDeliveryAddress ? ($deliveryContext['longitude'] ?? null) : null,
            ],
            'status' => $this->status,
            'expires_at' => $this->expires_at?->toISOString(),
            'offer_expires_at' => $this->offer_expires_at?->toISOString(),
            'seller' => $this->whenLoaded('claimedMerchant', fn () => $this->claimedMerchant ? [
                'merchant_id' => $this->claimedMerchant?->id,
                'display_name' => $this->claimedMerchant?->display_name,
                'username' => $this->claimedMerchant?->username,
                'is_verified' => (bool) $this->claimedMerchant?->is_verified,
                'kyc_status' => $this->claimedMerchant?->kyc_status,
                'eligible_to_sell' => (bool) $this->claimedMerchant?->canSellProducts(),
            ] : null),
            'product' => $this->whenLoaded('product', fn () => $this->product ? [
                'id' => $this->product->id,
                'title' => $this->product->title,
                'type' => $this->product->type,
            ] : null),
            'offer' => $this->offer_snapshot,
            'order' => $this->when($this->order_id, fn () => ['id' => $this->order_id, 'public_id' => $this->order?->public_id]),
            'invitations' => $this->whenLoaded('invitations', fn () => $this->invitations->map(fn ($invitation) => [
                'public_id' => $invitation->public_id,
                'channel' => $invitation->channel,
                'status' => $invitation->status,
                'sent_at' => $invitation->sent_at?->toISOString(),
                'expires_at' => $invitation->expires_at?->toISOString(),
            ])->values()),
            'events' => $this->whenLoaded('events', fn () => $this->events->map(fn ($event) => [
                'event_type' => $event->event_type,
                'from_status' => $event->from_status,
                'to_status' => $event->to_status,
                'channel' => $event->channel,
                'occurred_at' => $event->occurred_at?->toISOString(),
                'metadata' => $event->metadata,
            ])->values()),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
