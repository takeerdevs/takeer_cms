<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
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
        if ($order->buyer_id !== $userId && $order->product->merchant_id !== $userId && $request->user()->role !== 'admin') {
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
    ) {}

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
        if ($order->buyer_id !== $userId && $order->product->merchant_id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Determine receiver securely based strictly on context
        $receiverId = ($validated['acting_as'] === 'merchant') ? $order->buyer_id : $order->product->merchant->user_id ?? $order->product->merchant_id;

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
                $amount = (float)($validated['payload']['amount'] ?? 0);
                
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
                $order->quantity = $validated['payload']['quantity'] ?? 1;
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
                \App\Models\ProductReview::create([
                    'order_id' => $order->id,
                    'product_id' => $order->product_id,
                    'user_id' => $userId,
                    'rating' => $validated['payload']['stars'] ?? 5,
                    'comment' => $validated['payload']['comment'] ?? ''
                ]);
            } elseif ($actionType === 'shipping_proof') {
                $order->merchant_dispatch_video_url = $validated['payload']['mediaUrl'] ?? null;
                $order->save();
            } elseif ($actionType === 'suggest_product') {
                // No model mutation needed, payload carries product info
            } elseif ($actionType === 'add_to_order') {
                $item = $validated['payload']['product'] ?? null;
                if ($item) {
                    $itemKey = isset($item['variant_id']) ? "v-{$item['variant_id']}" : "p-{$item['id']}";
                    $mainKey = isset($order->variant_id) ? "v-{$order->variant_id}" : "p-{$order->product_id}";

                    if ($itemKey === $mainKey) {
                        $order->quantity = ($order->quantity ?? 1) + ($item['quantity'] ?? 1);
                    } else {
                        $extra = $order->extra_items ?? [];
                        $exists = false;
                        
                        foreach ($extra as &$existing) {
                            $existingKey = isset($existing['variant_id']) ? "v-{$existing['variant_id']}" : "p-{$existing['id']}";
                            if ($existingKey === $itemKey) {
                                $existing['quantity'] = ($existing['quantity'] ?? 1) + ($item['quantity'] ?? 1);
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
                                'quantity' => $item['quantity'] ?? 1,
                                'image' => $item['image'] ?? null,
                                'variant_name' => $item['variant_name'] ?? null
                            ];
                        }
                        $order->extra_items = $extra;
                    }
                    $order->total_paid = $this->calculateTotal($order);
                    $order->save();
                }
            } elseif ($actionType === 'remove_item') {
                if ($order->payment_status !== 'paid') {
                    $itemId = $validated['payload']['id'] ?? null;
                    $variantId = $validated['payload']['variant_id'] ?? null;
                    $isMain = (int)$order->product_id === (int)$itemId && (!$variantId || (int)$order->variant_id === (int)$variantId);
                    
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
                        $order->extra_items = array_values(array_filter($extra, function($e) use ($itemId, $variantId) {
                            if ($variantId) return (int)($e['variant_id'] ?? 0) !== (int)$variantId;
                            return (int)$e['id'] !== (int)$itemId;
                        }));
                        $order->total_paid = $this->calculateTotal($order);
                        $order->save();
                    }
                }
            } elseif ($actionType === 'update_item_quantity') {
                if ($order->payment_status !== 'paid') {
                    $itemId = $validated['payload']['id'] ?? null;
                    $variantId = $validated['payload']['variant_id'] ?? null;
                    $newQty = (int)($validated['payload']['quantity'] ?? 1);
                    if ($newQty < 1) $newQty = 1;

                    $isMain = (int)$order->product_id === (int)$itemId && (!$variantId || (int)$order->variant_id === (int)$variantId);
                    
                    if ($isMain) {
                        $order->quantity = $newQty;
                    } else {
                        $extra = $order->extra_items ?? [];
                        foreach ($extra as &$e) {
                            $itemMatch = (int)$e['id'] === (int)$itemId && (!$variantId || (int)($e['variant_id'] ?? 0) === (int)$variantId);
                            if ($itemMatch) {
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
                if ($order->payment_status !== 'paid') {
                    $order->delete();
                    return response()->json(['message' => 'Order cancelled', 'order_deleted' => true], 200);
                }
            }
            try {
                if ($actionType === 'initiate_payment') {
                    $paymentPhone = $validated['payload']['payment_number'] ?? $order->payment_phone ?? $order->account_phone;
                    $order = $this->triggerPaymentPush($request, $order, $paymentPhone);
                    // Continue to return the message object so frontend can update optimistic UI
                } elseif ($actionType === 'update_delivery') {
                    if ($order->payment_status !== 'paid') {
                        $payload = $request->input('payload', []);
                        $deliveryType = $payload['delivery_type'] ?? 'shipping';
                        $zoneId = $payload['delivery_zone_id'] ?? null;
                        $shippingFee = (float)($payload['shipping_fee'] ?? 0);
                        
                        $order->shipping_fee = $shippingFee;
                        $order->total_paid = $this->calculateTotal($order);
                        $order->save();

                        $delivery = $order->delivery()->firstOrCreate(['order_id' => $order->id]);
                        $delivery->delivery_type = ($deliveryType === 'self_pickup') ? 'self_pickup' : 'shipping';
                        $delivery->shipping_zone_id = $zoneId ?: $delivery->shipping_zone_id;
                        $delivery->physical_address = $payload['physical_address'] ?? $delivery->physical_address;
                        $delivery->latitude = $payload['latitude'] ?? $delivery->latitude;
                        $delivery->longitude = $payload['longitude'] ?? $delivery->longitude;
                        $delivery->shipping_hotspot_id = $payload['shipping_hotspot_id'] ?? $delivery->shipping_hotspot_id;
                        
                        if ($delivery->delivery_status === 'inquiry') {
                            $delivery->delivery_status = ($deliveryType === 'self_pickup') ? 'awaiting_boda' : 'inquiry';
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
            'order' => $order->fresh()->load(['product', 'merchant.locations', 'delivery', 'dispute'])
        ], 201);
    }

    private function triggerPaymentPush(Request $request, Order $order, string $paymentPhone): Order
    {
        if ($order->payment_status !== 'pending') {
            throw new \Exception('Malipo tayari yameashiriwa au kukamilishwa.');
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
            $isPhysical = $order->product?->isPhysical();
            $targetStatus = $isPhysical ? 'awaiting_merchant_confirmation' : 'resolved_merchant_paid';
            
            $order->update(['payment_status' => $targetStatus]);
            
            if (!$isPhysical) {
                app(\App\Services\EntitlementService::class)->grantForOrder($order->fresh(['product']));
            }

            // Log TRA-ready transaction simulation
            \App\Models\Transaction::create([
                'user_id' => $order->buyer_id,
                'order_id' => $order->id,
                'type' => 'order_revenue',
                'gross_amount' => $order->total_paid,
                'net_amount' => $order->total_paid * 0.95,
                'tax_amount' => ($order->total_paid * 0.05) * 0.18,
                'reference' => 'SIM-CHAT-' . strtoupper(\Illuminate\Support\Str::random(10)),
            ]);

            // Freeze funds in merchant's wallet simulation
            $merchantUser = $order->merchant->user ?? $order->product->merchant->user ?? null;
            if ($merchantUser) {
                $wallet = $merchantUser->wallet()->firstOrCreate(
                    ['user_id' => $merchantUser->id],
                    ['balance' => 0, 'frozen_balance' => 0]
                );
                
                if ($isPhysical) {
                    $wallet->increment('frozen_balance', $order->total_paid);
                } else {
                    $wallet->increment('balance', $order->total_paid);
                }
            }

            return $order->fresh()->load(['product', 'merchant.locations', 'delivery', 'dispute']);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('ChatController@triggerPaymentPush error', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw $e;
        }
    }

    /**
     * Search products for the merchant (upsell)
     */
    public function merchantProducts(Request $request, Order $order): JsonResponse
    {
        $userId = $request->user()->id;
        if ($order->merchant_id !== $userId && $order->product->merchant_id !== $userId && $request->user()->role !== 'admin') {
            // Customer can also browse products for "Bidhaa Zaid"
            if ($order->buyer_id !== $userId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
        }

        $search = $request->query('q');
        $merchantId = $order->merchant_id ?: $order->product->merchant_id;

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
        $baseTotal = ($order->unit_price * $order->quantity);
        $shipping = $order->shipping_fee ?? 0;
        $discount = $order->discount_amount ?? 0;
        
        $total = ($baseTotal + $shipping) - $discount;

        if ($order->extra_items) {
            foreach ($order->extra_items as $item) {
                $total += (($item['price'] ?? 0) * ($item['quantity'] ?? 1));
            }
        }

        return (float) max(0, $total);
    }
}
