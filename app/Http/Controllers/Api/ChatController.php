<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderExtraItemFulfillmentService;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    /**
     * Get chat history scoped strictly to a specific order
     */
    public function index(Request $request, Order $order): JsonResponse
    {
        // Security: only buyer or merchant can view chat
        $userId = $request->user()->id;
        $merchantUserId = $order->merchant?->user_id ?? $order->product?->merchant?->user_id;
        if ($order->buyer_id !== $userId && $merchantUserId !== $userId && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized access to chat.'], 403);
        }

        $messages = Message::where('order_id', $order->id)
            ->with(['sender:id,name,role'])
            ->oldest()
            ->get();

        return response()->json([
            'order_id' => $order->id,
            'status' => $order->payment_status,
            'messages' => $messages
        ]);
    }

    public function __construct(
        private readonly \App\Payments\GatewayRegistry $gatewayRegistry,
        private readonly SmsService $smsService,
    ) {
    }

    /**
     * Send a new message inside the Safe-Chat thread
     */
    public function store(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'body' => 'required|string|max:1000',
            'media_url' => 'nullable|url',
            'type' => 'nullable|string|in:text,action',
            'payload' => 'nullable|array',
            'acting_as' => 'required|string|in:buyer,merchant'
        ]);

        $userId = $request->user()->id;

        // Security check
        $merchantUserId = $order->merchant?->user_id ?? $order->product?->merchant?->user_id;
        if ($order->buyer_id !== $userId && $merchantUserId !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Determine receiver securely based strictly on context
        $receiverId = ($validated['acting_as'] === 'merchant') ? $order->buyer_id : $merchantUserId;

        $payload = $validated['payload'] ?? [];
        $payload['acting_as'] = $validated['acting_as'];

        $message = Message::create([
            'order_id' => $order->id,
            'sender_id' => $userId,
            'receiver_id' => $receiverId,
            'type' => $validated['type'] ?? 'text',
            'body' => $validated['body'],
            'payload' => $payload,
            'media_url' => $validated['media_url'] ?? null
        ]);

        if (($validated['type'] ?? 'text') === 'action') {
            $actionType = $validated['payload']['action_type'] ?? null;

            if ($actionType === 'discount') {
                $mode = $validated['payload']['mode'] ?? 'set';
                $amount = (float) ($validated['payload']['amount'] ?? 0);

                if ($mode === 'add') {
                    $order->discount_amount = ($order->discount_amount ?? 0) + $amount;
                } elseif ($mode === 'deduct') {
                    $order->discount_amount = max(0, ($order->discount_amount ?? 0) - $amount);
                } elseif ($mode === 'reset') {
                    $order->discount_amount = 0;
                } else {
                    $order->discount_amount = $amount;
                }

                $order->total_paid = $this->calculateTotal($order);
                $order->save();
            } elseif ($actionType === 'quantity') {
                $quantity = max(0.001, (float) ($validated['payload']['quantity'] ?? 1));
                $order->requested_quantity = $quantity;
                $order->quantity = (int) ceil($quantity);
                $order->total_paid = $this->calculateTotal($order);
                $order->save();
            } elseif ($actionType === 'shipping_cost') {
                $order->shipping_fee = $validated['payload']['amount'] ?? 0;
                $order->total_paid = $this->calculateTotal($order);
                $order->save();
            } elseif ($actionType === 'complaint') {
                \App\Models\Dispute::updateOrCreate(
                    ['order_id' => $order->id],
                    ['dispute_reason' => $validated['payload']['reason'] ?? '', 'status' => 'pending']
                );
                $order->payment_status = 'disputed';
                $order->save();
            } elseif ($actionType === 'complaint_resolved') {
                if ($order->dispute) {
                    $order->dispute->update(['status' => 'resolved']);
                }
                $order->payment_status = 'escrow_locked';
                $order->save();
            } elseif ($actionType === 'complaint_appealed') {
                if ($order->dispute) {
                    $order->dispute->update(['status' => 'escalated']);
                }
            } elseif ($actionType === 'review') {
                // Prevent duplicate reviews for the same order
                $exists = \App\Models\ProductReview::where('order_id', $order->id)->exists();
                if (!$exists) {
                    $review = \App\Models\ProductReview::create([
                        'order_id' => $order->id,
                        'product_id' => $order->product_id,
                        'user_id' => $userId,
                        'rating' => $validated['payload']['stars'] ?? 5,
                        'comment' => $validated['payload']['comment'] ?? ''
                    ]);
                    app(\App\Services\PulseNotificationService::class)->reviewCreated($review);
                }
            } elseif ($actionType === 'shipping_proof') {
                $order->merchant_dispatch_video_url = $validated['payload']['mediaUrl'] ?? null;
                $order->save();
            } elseif ($actionType === 'unboxing_video') {
                if ($order->delivery) {
                    $order->delivery->update([
                        'buyer_unboxing_video_url' => $validated['payload']['mediaUrl'] ?? null
                    ]);
                }
            } elseif ($actionType === 'suggest_product') {
                // No model mutation needed, payload carries product info
            } elseif ($actionType === 'add_to_order') {
                $item = $validated['payload']['product'] ?? null;
                if ($item) {
                    $productMeta = Product::query()->find((int) ($item['id'] ?? 0));
                    $isPhysicalItem = ($productMeta?->type ?? ($item['type'] ?? $item['product_type'] ?? null)) === 'physical';
                    $itemQuantity = $isPhysicalItem ? ($item['quantity'] ?? 1) : 1;
                    $itemKey = isset($item['variant_id']) ? "v-{$item['variant_id']}" : "p-{$item['id']}";
                    $mainKey = isset($order->variant_id) ? "v-{$order->variant_id}" : "p-{$order->product_id}";

                    if ($itemKey === $mainKey) {
                        if (($order->product?->type ?? null) === 'physical') {
                            $currentRequestedQuantity = $this->effectivePrimaryQuantity($order);
                            $order->requested_quantity = $currentRequestedQuantity + $itemQuantity;
                            $order->quantity = (int) ceil($order->requested_quantity);
                            $this->markQuantityRepresentsPackages($order);
                        }
                    } else {
                        $extra = $order->extra_items ?? [];
                        $exists = false;

                        foreach ($extra as &$existing) {
                            $existingKey = isset($existing['variant_id']) ? "v-{$existing['variant_id']}" : "p-{$existing['id']}";
                            if ($existingKey === $itemKey) {
                                if (($existing['type'] ?? $existing['product_type'] ?? null) === 'physical') {
                                    $existing['quantity'] = ($existing['quantity'] ?? 1) + $itemQuantity;
                                } else {
                                    $existing['quantity'] = 1;
                                }
                                $exists = true;
                                break;
                            }
                        }
                        if (!$exists) {
                            $extra[] = [
                                'id' => $item['id'],
                                'variant_id' => $item['variant_id'] ?? null,
                                'title' => $item['title'],
                                'price' => $item['price'],
                                'quantity' => $itemQuantity,
                                'image' => $item['image'] ?? null,
                                'variant_name' => $item['variant_name'] ?? null,
                                'type' => $productMeta?->type ?? ($item['type'] ?? null),
                                'product_type' => $productMeta?->type ?? ($item['product_type'] ?? $item['type'] ?? null),
                                'digital_delivery_type' => $productMeta?->digital_delivery_type ?? ($item['digital_delivery_type'] ?? null),
                                'digital_content_type' => $productMeta?->digital_content_type ?? ($item['digital_content_type'] ?? null),
                                'service_location_type' => $productMeta?->service_location_type ?? ($item['service_location_type'] ?? null),
                            ];
                        }
                        $order->extra_items = $extra;
                    }
                    $order->total_paid = $this->calculateTotal($order);
                    $order->save();
                }
            } elseif ($actionType === 'remove_item') {
                if ($order->canBeCancelledBeforePayment()) {
                    $itemId = $validated['payload']['id'] ?? null;
                    $variantId = $validated['payload']['variant_id'] ?? null;
                    $isMain = (int) $order->product_id === (int) $itemId && (!$variantId || (int) $order->variant_id === (int) $variantId);

                    if ($isMain) {
                        $extra = $order->extra_items ?? [];
                        if (!empty($extra)) {
                            // Promote first extra item to main
                            $promoted = array_shift($extra);
                            $order->product_id = $promoted['id'];
                            $order->variant_id = $promoted['variant_id'] ?? null;
                            $order->unit_price = $promoted['price'];
                            $order->quantity = $promoted['quantity'];
                            $order->extra_items = $extra;
                            $order->total_paid = $this->calculateTotal($order);
                            $order->save();
                        } else {
                            // No items left, delete order
                            $order->delete();
                            return response()->json(['message' => 'Order deleted as it became empty', 'order_deleted' => true], 200);
                        }
                    } else {
                        // Remove from extra items
                        $extra = $order->extra_items ?? [];
                        $order->extra_items = array_values(array_filter($extra, function ($e) use ($itemId, $variantId) {
                            if ($variantId)
                                return (int) ($e['variant_id'] ?? 0) !== (int) $variantId;
                            return (int) $e['id'] !== (int) $itemId;
                        }));
                        $order->total_paid = $this->calculateTotal($order);
                        $order->save();
                    }
                }
            } elseif ($actionType === 'update_item_quantity') {
                if ($order->canBeCancelledBeforePayment()) {
                    $itemId = $validated['payload']['id'] ?? null;
                    $variantId = $validated['payload']['variant_id'] ?? null;
                    $newQty = max(0.001, (float) ($validated['payload']['quantity'] ?? 1));

                    $isMain = (int) $order->product_id === (int) $itemId && (!$variantId || (int) $order->variant_id === (int) $variantId);

                    if ($isMain) {
                        if (($order->product?->type ?? null) === 'physical') {
                            $order->requested_quantity = $newQty;
                            $order->quantity = (int) ceil($newQty);
                            $this->markQuantityRepresentsPackages($order);
                        }
                    } else {
                        $extra = $order->extra_items ?? [];
                        foreach ($extra as &$e) {
                            $itemMatch = (int) $e['id'] === (int) $itemId && (!$variantId || (int) ($e['variant_id'] ?? 0) === (int) $variantId);
                            if ($itemMatch && ($e['type'] ?? $e['product_type'] ?? null) === 'physical') {
                                $e['quantity'] = $newQty;
                                break;
                            }
                        }
                        $order->extra_items = $extra;
                    }
                    $order->total_paid = $this->calculateTotal($order);
                    $order->save();
                }
            } elseif ($actionType === 'cancel_order') {
                if ($order->canBeCancelledBeforePayment()) {
                    $order->releaseInventory();
                    $order->update([
                        'payment_status' => 'failed',
                        'cancelled_at' => now(),
                        'cancelled_by' => $validated['acting_as'],
                        'cancellation_reason' => $validated['payload']['reason'] ?? 'Cancelled from order chat.',
                    ]);
                    return response()->json(['message' => 'Order cancelled', 'order_deleted' => true], 200);
                }
            }
            try {
                if ($actionType === 'initiate_payment') {
                    $paymentPhone = $validated['payload']['payment_number'] ?? $order->payment_phone ?? $order->account_phone;
                    $this->ensureSelfPickupPin($order);
                    $order = $this->triggerPaymentPush($request, $order, $paymentPhone);

                    $payload = $message->payload ?: [];
                    $order->loadMissing(['delivery', 'product']);
                    $isSelfPickupPhysical = $this->orderHasPhysicalItems($order)
                        && $order->delivery?->delivery_type === 'self_pickup'
                        && filled($order->delivery?->pickup_pin);

                    $message->forceFill([
                        'payload' => array_merge($payload, [
                            'payment_status' => $order->payment_status,
                            'delivery_type' => $order->delivery?->delivery_type,
                            'pickup_pin' => $isSelfPickupPhysical ? (string) $order->delivery->pickup_pin : null,
                            'show_shop_locations' => $isSelfPickupPhysical,
                            'product_title' => $order->product?->title,
                            'total_paid' => (float) $order->total_paid,
                        ]),
                    ])->save();
                    // Continue to return the message object so frontend can update optimistic UI
                } elseif ($actionType === 'update_delivery') {
                    if ($order->canBeCancelledBeforePayment()) {
                        $payload = $request->input('payload', []);
                        $deliveryType = $payload['delivery_type'] ?? 'shipping';
                        $zoneId = $payload['delivery_zone_id'] ?? null;
                        $shippingFee = (float) ($payload['shipping_fee'] ?? 0);

                        $order->shipping_fee = ($deliveryType === 'self_pickup') ? 0 : $shippingFee;
                        $order->total_paid = $this->calculateTotal($order);
                        $order->save();

                        $delivery = $order->delivery()->firstOrCreate(['order_id' => $order->id]);
                        $delivery->delivery_type = ($deliveryType === 'self_pickup') ? 'self_pickup' : 'shipping';
                        $delivery->shipping_zone_id = $zoneId ?: $delivery->shipping_zone_id;
                        $delivery->physical_address = $payload['physical_address'] ?? $delivery->physical_address;
                        $delivery->latitude = $payload['latitude'] ?? $delivery->latitude;
                        $delivery->longitude = $payload['longitude'] ?? $delivery->longitude;
                        $delivery->shipping_hotspot_id = $payload['shipping_hotspot_id'] ?? $delivery->shipping_hotspot_id;

                        // Generate pickup PIN if customer chose self_pickup and one doesn't exist yet
                        if ($deliveryType === 'self_pickup' && !$delivery->pickup_pin) {
                            $delivery->pickup_pin = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
                        }

                        if ($delivery->delivery_status === 'inquiry') {
                            $delivery->delivery_status = ($deliveryType === 'self_pickup') ? 'awaiting_pickup' : 'inquiry';
                        }
                        $delivery->save();
                    }
                }
            } catch (\Exception $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        // Load relations before blasting
        $message->load('sender:id,name,role');

        // Broadcast to Reverb presence/private channel
        broadcast(new MessageSent($message, $order))->toOthers();

        return response()->json([
            'message' => $message,
            'order' => $order->fresh()->load(['product.unitType', 'product.images', 'merchant.locations', 'delivery', 'dispute', 'review'])
        ], 201);
    }

    private function ensureSelfPickupPin(Order $order): void
    {
        $order->loadMissing('delivery');

        if (! $this->orderHasPhysicalItems($order) || $order->delivery?->delivery_type !== 'self_pickup') {
            return;
        }

        $delivery = $order->delivery()->firstOrCreate(['order_id' => $order->id]);

        if (! $delivery->pickup_pin) {
            $delivery->pickup_pin = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        }

        if (! $delivery->delivery_status || $delivery->delivery_status === 'inquiry' || $delivery->delivery_status === 'awaiting_boda') {
            $delivery->delivery_status = 'awaiting_pickup';
        }

        $delivery->save();
        $order->setRelation('delivery', $delivery);
    }

    private function orderHasPhysicalItems(Order $order): bool
    {
        if ($order->requiresPhysicalFulfillment()) {
            return true;
        }

        foreach (($order->extra_items ?? []) as $item) {
            $type = $item['type'] ?? $item['product_type'] ?? null;
            if ($type === 'physical') {
                return true;
            }
        }

        return false;
    }

    private function triggerPaymentPush(Request $request, Order $order, string $paymentPhone): Order
    {
        if ($order->payment_status !== 'pending') {
            throw new \Exception('Malipo yamekamilishwa.');
        }

        if ($order->requiresPhysicalFulfillment() && $order->inquiry_status !== 'quoted') {
            throw new \Exception('Merchant must confirm stock and send the agreed quote before payment.');
        }

        // 1. Precise recalculation to avoid discrepancies
        $order->total_paid = $this->calculateTotal($order);
        $order->payment_phone = $paymentPhone;

        // 2. Resolve Gateway
        try {
            $gateway = $this->gatewayRegistry->resolve($request, $paymentPhone);
            $countryCode = $this->gatewayRegistry->resolveCountry($request, $paymentPhone);

            $order->payment_gateway = $gateway->getName();
            $order->country_code = $countryCode;
            $order->save();
        } catch (\RuntimeException $e) {
            throw new \Exception('Huduma ya malipo haipatikani kwa sasa.');
        }

        // 3. Trigger Gateway Payment
        try {
            // SIMULATION: Auto-approve payment for testing
            $isPhysical = $order->requiresPhysicalFulfillment();
            $isCustomDelivery = $order->product?->isDigital()
                && ($order->product?->digital_delivery_type ?? null) === 'custom_delivery';
            $targetStatus = $isPhysical ? 'awaiting_merchant_confirmation' : ($isCustomDelivery ? 'escrow_locked' : 'resolved_merchant_paid');
            $childOrders = collect();

            \Illuminate\Support\Facades\DB::transaction(function () use ($order, $targetStatus, $isPhysical, $isCustomDelivery, &$childOrders) {
                if ($isPhysical) {
                    $this->reservePhysicalOrderInventory($order);
                }

                $childOrders = app(OrderExtraItemFulfillmentService::class)->splitPaidExtras($order->fresh(['product', 'variant', 'delivery', 'merchant']));
                $order->refresh();

                if ($isPhysical) {
                    $order->markPhysicalAgreement([
                        'total_paid' => (float) $order->total_paid,
                        'notes' => 'Buyer accepted the quoted physical order in chat.',
                    ]);
                }

                $order->update([
                    'payment_status' => $targetStatus,
                    'custom_delivery_due_at' => $isCustomDelivery ? $order->customDeliveryDueAtFrom() : $order->custom_delivery_due_at,
                    'merchant_confirmed_at' => $isPhysical ? now() : $order->merchant_confirmed_at,
                ]);
            });

            $processedOrders = collect([$order->fresh(['product', 'merchant.user'])])
                ->merge($childOrders->map(fn (Order $child) => $child->fresh(['product', 'merchant.user', 'delivery'])));

            foreach ($processedOrders as $processedOrder) {
                if (!$processedOrder->requiresPhysicalFulfillment()) {
                    app(\App\Services\EntitlementService::class)->grantForOrder($processedOrder->fresh(['product']));
                }
            }

            // Log TRA-ready transaction simulation
            foreach ($processedOrders as $processedOrder) {
                $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($processedOrder, (float) $processedOrder->total_paid);
                \App\Models\Transaction::create([
                    'user_id' => $processedOrder->buyer_id,
                    'merchant_id' => $processedOrder->merchant_id,
                    'order_id' => $processedOrder->id,
                    'type' => 'order_revenue',
                    ...$fee['snapshot'],
                    'gross_amount' => $processedOrder->total_paid,
                    'fee_amount' => $fee['fee_amount'],
                    'net_amount' => $fee['net_amount'],
                    'tax_amount' => $fee['tax_amount'],
                    'reference' => 'SIM-CHAT-' . strtoupper(\Illuminate\Support\Str::random(10)),
                ]);

                // Freeze funds for physical/custom-held work, release immediately for instant digital/access orders.
                $merchant = $processedOrder->merchant ?? $processedOrder->product?->merchant ?? null;
                if ($merchant?->user) {
                    $wallet = $merchant->wallet()->firstOrCreate(
                        ['merchant_id' => $merchant->id],
                        ['user_id' => $merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
                    );

                    if ($processedOrder->requiresPhysicalFulfillment() || $processedOrder->payment_status === 'escrow_locked') {
                        $wallet->increment('frozen_balance', $processedOrder->total_paid);
                    } else {
                        $wallet->increment('balance', $fee['net_amount']);
                    }
                }
            }

            if ($isPhysical) {
                $order->loadMissing(['buyer', 'merchant.user', 'delivery']);
                $publicId = (string) ($order->public_id ?: $order->id);
                if ($order->buyer?->phone_number) {
                    $this->smsService->sendPhysicalPaymentHeldToBuyer($order->buyer->phone_number, $publicId, (float) $order->total_paid, $order->buyer_id);
                    if ($order->delivery?->delivery_type === 'self_pickup' && $order->delivery?->pickup_pin) {
                        $this->smsService->sendPickupPinToBuyer($order->buyer->phone_number, $publicId, (string) $order->delivery->pickup_pin, $order->buyer_id);
                    }
                }
                $merchantUser = $order->merchant->user ?? $order->product?->merchant?->user ?? null;
                if ($merchantUser?->phone_number) {
                    $this->smsService->sendPhysicalPaymentHeldToMerchant($merchantUser->phone_number, $publicId, (float) $order->total_paid, $merchantUser->id);
                }
            } else {
                $order->loadMissing(['buyer', 'product']);
                $phone = $order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone;
                if ($phone && $order->product && ($order->product->isDigital() || $order->product->isService())) {
                    $this->smsService->sendDigitalDeliveryNotification(
                        $phone,
                        (string) $order->product->title,
                        url('/orders'),
                        $order->buyer_id,
                        'digital-delivery:'.($order->public_id ?: $order->id)
                    );
                }
            }

            return $order->fresh()->load(['product', 'merchant.locations', 'delivery', 'dispute', 'review']);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('ChatController@triggerPaymentPush error', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    private function reservePhysicalOrderInventory(Order $order): void
    {
        $order->loadMissing(['product', 'variant']);

        if ($order->inventory_reserved_at) {
            return;
        }

        if ($order->purchasable_type === 'bundle') {
            foreach (($order->bundle_item_selection ?? []) as $lineItem) {
                if (($lineItem['item_type'] ?? null) !== 'product' || ($lineItem['product_type'] ?? null) !== 'physical') {
                    continue;
                }

                $quantity = max(1, (int) ($lineItem['quantity'] ?? 1));
                $selectedProduct = Product::query()->find((int) ($lineItem['item_id'] ?? 0));
                if (!$selectedProduct?->isPhysical()) {
                    continue;
                }

                $selectedVariantId = (int) ($lineItem['selected_variant_id'] ?? 0);
                if ($selectedVariantId > 0) {
                    $variantUpdated = \App\Models\ProductVariant::query()
                        ->whereKey($selectedVariantId)
                        ->where('product_id', $selectedProduct->id)
                        ->where('inventory_count', '>=', $quantity)
                        ->decrement('inventory_count', $quantity);

                    if ($variantUpdated === 0) {
                        throw new \RuntimeException("{$selectedProduct->title} variant imeisha au haitoshi kwa quantity uliyochagua.");
                    }
                }

                $updated = Product::query()
                    ->whereKey($selectedProduct->id)
                    ->where('inventory_count', '>=', $quantity)
                    ->decrement('inventory_count', $quantity);

                if ($updated === 0) {
                    throw new \RuntimeException("{$selectedProduct->title} imeisha au haitoshi kwa bundle hii.");
                }

                $this->decrementLocationInventory($selectedProduct->id, $selectedVariantId > 0 ? $selectedVariantId : null, $quantity, $selectedProduct->merchant_id);
            }

            $order->forceFill(['inventory_reserved_at' => now()])->saveQuietly();
            return;
        }

        $product = $order->product;
        if (!$product?->isPhysical()) {
            return;
        }

        $requestedQuantity = max(0.001, (float) ($order->requested_quantity ?: $order->quantity ?: 1));
        $quantity = (int) ceil($requestedQuantity);
        if ($order->variant) {
            $variantUpdated = \App\Models\ProductVariant::query()
                ->whereKey($order->variant->id)
                ->where('product_id', $product->id)
                ->where('inventory_count', '>=', $quantity)
                ->decrement('inventory_count', $quantity);

            \App\Models\ProductVariant::query()
                ->whereKey($order->variant->id)
                ->where('inventory_quantity', '>=', $requestedQuantity)
                ->decrement('inventory_quantity', $requestedQuantity);

            if ($variantUpdated === 0) {
                throw new \RuntimeException('Variant uliyochagua imeisha au haitoshi.');
            }
        }

        $updated = Product::query()
            ->whereKey($product->id)
            ->where('inventory_count', '>=', $quantity)
            ->decrement('inventory_count', $quantity);

        Product::query()
            ->whereKey($product->id)
            ->where('inventory_quantity', '>=', $requestedQuantity)
            ->decrement('inventory_quantity', $requestedQuantity);

        if ($updated === 0) {
            throw new \RuntimeException('Bidhaa hii imeisha.');
        }

        $this->decrementLocationInventory($product->id, $order->variant_id, $requestedQuantity, $product->merchant_id);
        $order->forceFill(['inventory_reserved_at' => now()])->saveQuietly();
    }

    private function decrementLocationInventory(int $productId, ?int $variantId, float $quantity, int $merchantId): void
    {
        $integerQuantity = (int) ceil($quantity);
        $inventory = \App\Models\ProductLocationInventory::query()
            ->when($variantId, fn ($query) => $query->whereNull('product_id'), fn ($query) => $query->where('product_id', $productId))
            ->where('product_variant_id', $variantId)
            ->where('quantity', '>=', $integerQuantity)
            ->orderByDesc('quantity')
            ->first();

        if ($inventory) {
            if ($inventory->quantity_decimal !== null) {
                $newQuantity = max(0, (float) $inventory->quantity_decimal - $quantity);
                $inventory->update([
                    'quantity' => (int) ceil($newQuantity),
                    'quantity_decimal' => $newQuantity,
                ]);
            } else {
                $inventory->decrement('quantity', $integerQuantity);
            }
            return;
        }

        $primaryLocation = \App\Models\MerchantLocation::where('merchant_id', $merchantId)
            ->where('is_primary', true)
            ->first() ?? \App\Models\MerchantLocation::where('merchant_id', $merchantId)->first();

        if ($primaryLocation) {
            \App\Models\ProductLocationInventory::updateOrCreate(
                [
                    'merchant_location_id' => $primaryLocation->id,
                    'product_id' => $variantId ? null : $productId,
                    'product_variant_id' => $variantId,
                ],
                [
                    'quantity' => \Illuminate\Support\Facades\DB::raw("GREATEST(0, quantity - {$integerQuantity})"),
                    'quantity_decimal' => \Illuminate\Support\Facades\DB::raw("GREATEST(0, COALESCE(quantity_decimal, quantity) - {$quantity})"),
                ]
            );
        }
    }

    /**
     * Search products for the merchant (upsell)
     */
    public function merchantProducts(Request $request, Order $order): JsonResponse
    {
        $userId = $request->user()->id;
        $merchantUserId = $order->merchant?->user_id ?? $order->product?->merchant?->user_id;
        if ($merchantUserId !== $userId && $request->user()->role !== 'admin') {
            // Customer can also browse products for "Bidhaa Zaid"
            if ($order->buyer_id !== $userId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $search = $request->query('q');
        $merchantId = $order->merchant_id ?: $order->product?->merchant_id;

        $products = Product::where('merchant_id', $merchantId)
            ->with(['variants', 'images', 'attributes'])
            ->when($search, function ($query, $search) {
                $query->where('title', 'like', "%{$search}%");
            })
            ->latest()
            ->paginate(12);

        return response()->json([
            'data' => \App\Http\Resources\ProductResource::collection($products)->response()->getData(true)
        ]);
    }

    private function calculateTotal(Order $order): float
    {
        $requestedQuantity = $this->effectivePrimaryQuantity($order);
        $baseTotal = ((float) $order->unit_price) * $requestedQuantity;
        $shipping = $order->shipping_fee ?? 0;
        $discount = $order->discount_amount ?? 0;

        $total = ($baseTotal + $shipping) - $discount;

        if ($order->extra_items) {
            foreach ($order->extra_items as $item) {
                $itemType = $item['type'] ?? $item['product_type'] ?? null;
                if (! $itemType && isset($item['id'])) {
                    $itemType = Product::query()->whereKey((int) $item['id'])->value('type');
                }
                $quantity = $itemType === 'physical' ? ($item['quantity'] ?? 1) : 1;
                $total += (($item['price'] ?? 0) * $quantity);
            }
        }

        return (float) max(0, $total);
    }

    private function effectivePrimaryQuantity(Order $order): float
    {
        $quantity = max(0.001, (float) ($order->requested_quantity ?: $order->quantity ?: 1));
        $snapshot = $order->unit_snapshot ?? [];

        if (! $this->isPackageSnapshot($snapshot)) {
            return $quantity;
        }

        if (($snapshot['quantity_represents_packages'] ?? false) === true) {
            return $quantity;
        }

        $sellableQuantity = max(0.001, (float) ($snapshot['sellable_quantity'] ?? 1));
        return $quantity / $sellableQuantity;
    }

    private function markQuantityRepresentsPackages(Order $order): void
    {
        $snapshot = $order->unit_snapshot ?? [];
        if (! $this->isPackageSnapshot($snapshot)) {
            return;
        }

        $snapshot['quantity_represents_packages'] = true;
        $order->unit_snapshot = $snapshot;
    }

    private function isPackageSnapshot(array $snapshot): bool
    {
        if (empty($snapshot)) {
            return false;
        }

        $code = strtolower((string) ($snapshot['code'] ?? ''));
        $symbol = strtolower((string) ($snapshot['symbol'] ?? ''));
        $name = strtolower((string) ($snapshot['name'] ?? ''));

        return ! empty($snapshot['package_content_quantity'])
            || in_array($code, ['pack', 'package', 'pkg'], true)
            || in_array($symbol, ['pack', 'package', 'pkg'], true)
            || str_contains($name, 'package')
            || str_contains($name, 'pack');
    }
}
