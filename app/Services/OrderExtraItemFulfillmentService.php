<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;

class OrderExtraItemFulfillmentService
{
    public function splitPaidExtras(Order $parent): Collection
    {
        $parent->loadMissing(['product', 'variant', 'delivery', 'merchant']);
        $extras = collect($parent->extra_items ?? []);

        if ($extras->isEmpty()) {
            return collect();
        }

        $createdOrders = collect();
        $updatedExtras = [];

        foreach ($extras as $index => $item) {
            if (!empty($item['split_order_id'])) {
                $existing = Order::query()->find((int) $item['split_order_id']);
                if ($existing) {
                    $createdOrders->push($existing);
                }
                $updatedExtras[] = $item;
                continue;
            }

            $product = Product::query()
                ->with(['unitType', 'packageContentUnitType'])
                ->where('merchant_id', $parent->merchant_id)
                ->find((int) ($item['id'] ?? 0));

            if (!$product) {
                $updatedExtras[] = $item;
                continue;
            }

            $variantId = isset($item['variant_id']) ? (int) $item['variant_id'] : null;
            $variant = $variantId ? ProductVariant::query()
                ->where('product_id', $product->id)
                ->find($variantId) : null;
            $unitPrice = (float) ($item['price'] ?? ($variant?->price ?? $product->price ?? 0));
            $isPhysical = $product->isPhysical();
            $quantity = $isPhysical ? max(1, (int) ceil((float) ($item['quantity'] ?? 1))) : 1;
            $lineTotal = round($unitPrice * $quantity, 2);
            $isCustomDigital = $product->isDigital() && ($product->digital_delivery_type ?? null) === 'custom_delivery';
            $status = $isPhysical ? 'awaiting_merchant_confirmation' : ($isCustomDigital ? 'escrow_locked' : 'resolved_merchant_paid');
            $idempotencyKey = "split-extra:{$parent->id}:{$index}:{$product->id}:".($variantId ?: 'base');

            $child = Order::query()->firstOrCreate(
                ['idempotency_key' => $idempotencyKey],
                [
                    'buyer_id' => $parent->buyer_id,
                    'merchant_id' => $parent->merchant_id,
                    'product_id' => $product->id,
                    'variant_id' => $variant?->id,
                    'variant_snapshot' => $variant ? [
                        'id' => $variant->id,
                        'name' => $variant->name,
                        'sku' => $variant->sku,
                        'attributes' => $variant->attributes ?? [],
                        'swatch_image_url' => $variant->swatch_image_url,
                    ] : null,
                    'purchasable_type' => 'product',
                    'purchasable_id' => $product->id,
                    'quantity' => $quantity,
                    'requested_quantity' => $quantity,
                    'product_unit_type_id' => $product->product_unit_type_id,
                    'unit_snapshot' => $product->unitType ? [
                        'id' => $product->unitType->id,
                        'name' => $product->unitType->name,
                        'symbol' => $product->unitType->symbol,
                        'allows_decimal' => (bool) $product->unitType->allows_decimal,
                        'sellable_quantity' => (float) ($product->sellable_quantity ?: 1),
                        'quantity_represents_packages' => true,
                    ] : null,
                    'unit_price' => $unitPrice,
                    'total_paid' => $lineTotal,
                    'payment_status' => $status,
                    'transaction_ref' => null,
                    'account_phone' => $parent->account_phone,
                    'payment_phone' => $parent->payment_phone,
                    'payment_gateway' => $parent->payment_gateway,
                    'country_code' => $parent->country_code,
                    'source' => 'chat_upsell',
                    'is_inquiry' => $isPhysical,
                    'inquiry_status' => $isPhysical ? 'quoted' : null,
                    'shipping_fee' => 0,
                    'discount_amount' => 0,
                    'agreement_snapshot' => [
                        'split_from_order_id' => $parent->id,
                        'split_from_public_id' => $parent->public_id,
                        'source' => 'chat_extra_item',
                        'offered_at' => now()->toISOString(),
                    ],
                    'agreed_at' => $isPhysical ? now() : null,
                    'merchant_confirmed_at' => $isPhysical ? now() : $parent->merchant_confirmed_at,
                    'custom_delivery_due_at' => $isCustomDigital ? $this->customDeliveryDueAt($product) : null,
                ]
            );

            if ($isPhysical) {
                $this->reservePhysicalInventory($child->fresh(['product', 'variant']));
                $this->cloneDelivery($parent, $child);
            }

            $createdOrders->push($child->fresh(['product', 'merchant', 'delivery']));
            $updatedExtras[] = [
                ...$item,
                'split_order_id' => $child->id,
                'split_public_id' => $child->public_id,
                'type' => $product->type,
                'product_type' => $product->type,
                'digital_delivery_type' => $product->digital_delivery_type,
                'digital_content_type' => $product->digital_content_type,
                'service_location_type' => $product->service_location_type,
            ];
        }

        $parent->forceFill([
            'extra_items' => $updatedExtras,
            'total_paid' => $this->baseTotal($parent),
        ])->save();

        return $createdOrders;
    }

    private function baseTotal(Order $order): float
    {
        $requestedQuantity = max(0.001, (float) ($order->requested_quantity ?: $order->quantity ?: 1));
        $sellableQuantity = max(0.001, (float) data_get($order->unit_snapshot, 'sellable_quantity', 1));
        $baseTotal = ((float) $order->unit_price) * ($requestedQuantity / $sellableQuantity);
        $shipping = (float) ($order->shipping_fee ?? 0);
        $discount = (float) ($order->discount_amount ?? 0);

        return (float) max(0, round(($baseTotal + $shipping) - $discount, 2));
    }

    private function customDeliveryDueAt(Product $product)
    {
        $leadTimeDays = (int) ($product->availability_lead_time_days ?? 0);

        return $leadTimeDays > 0 ? now()->addDays($leadTimeDays) : null;
    }

    private function cloneDelivery(Order $parent, Order $child): void
    {
        if (!$parent->delivery) {
            return;
        }

        $child->delivery()->updateOrCreate(
            ['order_id' => $child->id],
            [
                'shipping_zone_id' => $parent->delivery->shipping_zone_id,
                'shipping_hotspot_id' => $parent->delivery->shipping_hotspot_id,
                'physical_address' => $parent->delivery->physical_address,
                'latitude' => $parent->delivery->latitude,
                'longitude' => $parent->delivery->longitude,
                'delivery_type' => $parent->delivery->delivery_type,
                'delivery_status' => $parent->delivery->delivery_type === 'self_pickup' ? 'awaiting_pickup' : ($parent->delivery->delivery_status ?: 'inquiry'),
                'pickup_pin' => $parent->delivery->delivery_type === 'self_pickup' ? str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT) : null,
                'buyer_release_pin' => $parent->delivery->delivery_type === 'self_pickup' ? null : str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
            ]
        );
    }

    private function reservePhysicalInventory(Order $order): void
    {
        $order->loadMissing(['product', 'variant']);

        if ($order->inventory_reserved_at || !$order->product?->isPhysical()) {
            return;
        }

        $quantity = max(1, (int) ceil((float) ($order->requested_quantity ?: $order->quantity ?: 1)));

        if ($order->variant) {
            $updatedVariant = ProductVariant::query()
                ->whereKey($order->variant->id)
                ->where('inventory_count', '>=', $quantity)
                ->decrement('inventory_count', $quantity);

            if ($updatedVariant === 0) {
                throw new \RuntimeException('Variant uliyochagua imeisha au haitoshi.');
            }
        }

        $updatedProduct = Product::query()
            ->whereKey($order->product_id)
            ->where('inventory_count', '>=', $quantity)
            ->decrement('inventory_count', $quantity);

        if ($updatedProduct === 0) {
            throw new \RuntimeException('Bidhaa hii imeisha.');
        }

        $order->forceFill(['inventory_reserved_at' => now()])->saveQuietly();
    }
}
