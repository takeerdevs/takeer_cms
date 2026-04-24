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
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price !== null ? (float) $this->unit_price : null,
            'total_paid' => (float) $this->total_paid,
            'payment_status' => $this->payment_status,
            'transaction_ref' => $this->transaction_ref,
            'account_phone' => $this->account_phone,
            'payment_phone' => $this->payment_phone,
            'product' => $this->whenLoaded('product', fn() => ProductResource::make($this->product)),
            'delivery' => $this->whenLoaded('delivery', fn() => [
                'delivery_status' => $this->delivery?->delivery_status,
                'bus_company' => $this->delivery?->bus_company,
                'waybill_tracking' => $this->delivery?->waybill_tracking_number,
            ]),
            'dispute' => $this->whenLoaded('dispute', fn() => [
                'status' => $this->dispute?->status,
                'dispute_reason' => $this->dispute?->dispute_reason,
            ]),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
