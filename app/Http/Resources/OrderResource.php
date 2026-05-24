<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'order_kind' => $this->order_kind,
            'purchasable_type' => $this->purchasable_type,
            'purchasable_id' => $this->purchasable_id,
            'variant_id' => $this->variant_id,
            'variant_snapshot' => $this->variant_snapshot,
            'bundle_item_selection' => $this->bundle_item_selection,
            'offering_group_selection' => $this->offering_group_selection,
            'quantity' => $this->quantity,
            'requested_quantity' => $this->requested_quantity !== null ? (float) $this->requested_quantity : (float) $this->quantity,
            'unit_snapshot' => $this->unit_snapshot,
            'unit_price' => $this->unit_price !== null ? (float) $this->unit_price : null,
            'total_paid' => (float) $this->total_paid,
            'payment_status' => $this->payment_status,
            'is_inquiry' => (bool) $this->is_inquiry,
            'inquiry_status' => $this->inquiry_status,
            'agreement_snapshot' => $this->agreement_snapshot,
            'agreed_at' => $this->agreed_at?->toISOString(),
            'merchant_confirmed_at' => $this->merchant_confirmed_at?->toISOString(),
            'is_merchant_confirmed' => $this->merchant_confirmed_at !== null,
            'paid_out_at' => $this->paid_out_at?->toISOString(),
            'transaction_ref' => $this->transaction_ref,
            'source' => $this->source,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'account_phone' => $this->account_phone,
            'payment_phone' => $this->payment_phone,
            'product' => $this->whenLoaded('product', fn() => ProductResource::make($this->product)),
            'buyer' => $this->whenLoaded('buyer'),
            'delivery' => $this->whenLoaded('delivery', fn() => [
                'delivery_status' => $this->delivery?->delivery_status,
                'status' => $this->delivery?->delivery_status,
                'delivery_type' => $this->delivery?->delivery_type,
                'type' => $this->delivery?->delivery_type,
                'physical_address' => $this->delivery?->physical_address,
                'shipping_zone' => $this->delivery?->shippingZone ? [
                    'id' => $this->delivery->shippingZone->id,
                    'zone_name' => $this->delivery->shippingZone->zone_name,
                    'destination_city' => $this->delivery->shippingZone->destination_city,
                    'destination_region' => $this->delivery->shippingZone->destination_region,
                    'flat_rate_fee' => $this->delivery->shippingZone->flat_rate_fee,
                ] : null,
                'pickup_pin' => $this->delivery?->pickup_pin,
                'buyer_release_pin' => $this->delivery?->buyer_release_pin,
                'bus_company' => $this->delivery?->bus_company,
                'waybill_tracking' => $this->delivery?->waybill_tracking_number,
                'waybill_tracking_number' => $this->delivery?->waybill_tracking_number,
                'waybill_photo_url' => $this->delivery?->waybill_photo_url,
                'events' => $this->delivery?->relationLoaded('events')
                    ? $this->delivery->events->sortBy('created_at')->map(fn ($event) => [
                        'id' => $event->id,
                        'status' => $event->status,
                        'actor_type' => $event->actor_type,
                        'actor_name' => $event->actor?->name,
                        'proof_url' => $event->proof_url,
                        'proof_mime' => $event->proof_mime,
                        'proof_type' => $event->proof_type,
                        'note' => $event->note,
                        'metadata' => $event->metadata,
                        'created_at' => $event->created_at?->toISOString(),
                    ])->values()
                    : [],
            ]),
            'dispute' => $this->whenLoaded('dispute', fn() => [
                'status' => $this->dispute?->status,
                'dispute_reason' => $this->dispute?->dispute_reason,
            ]),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
