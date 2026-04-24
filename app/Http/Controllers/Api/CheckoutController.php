<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Checkout\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingZone;
use App\Models\SubscriptionPlan;
use App\Payments\GatewayRegistry;
use App\Services\EntitlementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly GatewayRegistry $gatewayRegistry,
    ) {}

    /**
     * POST /api/v1/checkout/initiate
     *
     * 1. Resolve or create buyer (guest checkout supported)
     * 2. Detect country from phone prefix → GeoIP session → live GeoIP
     * 3. Resolve the correct payment gateway for that country
     * 4. Create a pending Order record
     * 5. Trigger gateway payment push (AzamPay USSD, future: M-Pesa, card redirect...)
     * 6. Return order + gateway-specific user message
     */
    public function initiate(CheckoutRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $paymentPhone = $validated['payment_number'] ?? null;
        $accountPhone = $validated['account_phone'] ?? null;

        // ── Guest buyer resolution ────────────────────────────────────────────
        $buyer = $request->user();

        if (!$buyer) {
            if (empty($validated['buyer_name']) || empty($accountPhone) || empty($paymentPhone)) {
                return response()->json(['message' => 'Jina, namba ya akaunti, na namba ya malipo vinahitajika.'], 400);
            }

            $phone = $accountPhone;
            $buyer = \App\Models\User::firstOrCreate(
                ['phone_number' => $phone],
                ['name' => $validated['buyer_name'], 'role' => 'buyer']
            );

            if (!$buyer->name && !empty($validated['buyer_name'])) {
                $buyer->update(['name' => $validated['buyer_name']]);
            }

            if (!$buyer->wallet) {
                \App\Models\Wallet::create(['user_id' => $buyer->id, 'balance' => 0, 'frozen_balance' => 0]);
            }
        } else {
            $accountPhone = $buyer->phone_number;
        }

        // ── Idempotency guard ─────────────────────────────────────────────────
        if (Order::where('idempotency_key', $validated['idempotency_key'])->exists()) {
            return response()->json(['message' => 'Hili agizo tayari lipo.'], 409);
        }

        // ── Resolve purchasable item ──────────────────────────────────────────
        $purchasable = $this->resolvePurchasable($validated['purchasable_type'], (int) $validated['purchasable_id']);
        $product     = $purchasable instanceof Product ? $purchasable : null;
        $selectedVariant = null;
        $selectedBundleItems = [];

        if ($product && $product->has_variants) {
            $variantId = (int) ($validated['variant_id'] ?? 0);
            $selectedVariant = ProductVariant::query()
                ->where('product_id', $product->id)
                ->where('is_active', true)
                ->where('inventory_count', '>', 0)
                ->find($variantId);

            if (!$selectedVariant) {
                return response()->json(['message' => 'Variant uliyochagua imeisha au haipatikani.'], 400);
            }
        }

        if ($product && !$product->isInStock()) {
            return response()->json(['message' => 'Bidhaa hii imeisha.'], 400);
        }

        // ── Calculate total payable ───────────────────────────────────────────
        $totalPaid = $this->resolveBasePrice($purchasable, $selectedVariant);
        if ($purchasable instanceof Bundle && $purchasable->is_individual_sale) {
            try {
                $selectedBundleItems = $this->resolveBundleSelection($purchasable, $validated['selected_bundle_items'] ?? []);
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 400);
            }
            if (!empty($selectedBundleItems)) {
                $totalPaid = (float) collect($selectedBundleItems)->sum('line_total');
            }
        }

        $zone = null;
        $isInquiry = false;
        $deliveryType = null;
        
        if ($product?->isPhysical()) {
            $shippingProfileId = $product->shipping_profile_id;
            
            // If product has no profile, try to find the merchant's default profile
            if (!$shippingProfileId) {
                $shippingProfileId = \App\Models\ShippingProfile::where('merchant_id', $product->merchant_id)
                    ->where('is_default', true)
                    ->value('id');
            }

            // Always start physical orders as inquiries for merchant validation/acknowledgement
            $isInquiry = true;

            $deliveryType = $validated['delivery_type'] ?? null;
            $zoneId = $validated['delivery_zone_id'] ?? null;

            if ($deliveryType === 'self_pickup') {
                // If explicit self-pickup, bypass zone lookup and use 0 fee
                $zone = null;
            } else if ($zoneId) {
                $zone = ShippingZone::where('shipping_profile_id', $shippingProfileId)
                    ->find($zoneId);
                
                if ($zone && $zone->merchant_id === $product->merchant_id) {
                    $totalPaid += $zone->flat_rate_fee;
                    $deliveryType = $zone->delivery_type;
                } else {
                    $zone = null; // Reset if invalid
                }
            } else {
                // If no zone selected, it's definitely an inquiry (already set)
            }
        }

        // ── Detect country + resolve gateway ──────────────────────────────────
        $phoneNumber = $paymentPhone;

        try {
            $gateway     = $this->gatewayRegistry->resolve($request, $phoneNumber);
            $countryCode = $this->gatewayRegistry->resolveCountry($request, $phoneNumber);
        } catch (RuntimeException $e) {
            Log::warning('CheckoutController: No gateway available.', [
                'phone' => $phoneNumber,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Huduma ya malipo haipatikani kwa nchi yako kwa sasa. Tafadhali wasiliana nasi.',
            ], 422);
        }

        // ── Create pending Order ──────────────────────────────────────────────
        $transactionRef = 'TXN-' . Str::upper(Str::random(10));

        try {
            $order = DB::transaction(function () use (
                $buyer, $product, $selectedVariant, $purchasable, $totalPaid, $validated,
                $transactionRef, $gateway, $countryCode, $accountPhone, $paymentPhone, $selectedBundleItems, $zone, $deliveryType, $isInquiry
            ) {
                if ($product?->isPhysical()) {
                    if ($selectedVariant) {
                        $updated = ProductVariant::query()
                            ->whereKey($selectedVariant->id)
                            ->where('inventory_count', '>', 0)
                            ->decrement('inventory_count');

                        Product::query()
                            ->whereKey($product->id)
                            ->where('inventory_count', '>', 0)
                            ->decrement('inventory_count');
                    } else {
                        $updated = Product::query()
                            ->whereKey($product->id)
                            ->where('inventory_count', '>', 0)
                            ->decrement('inventory_count');
                    }

                    if ($updated === 0) {
                        throw new RuntimeException('Bidhaa hii imeisha.');
                    }
                }
                if ($purchasable instanceof Bundle && !empty($selectedBundleItems)) {
                    foreach ($selectedBundleItems as $lineItem) {
                        if (($lineItem['item_type'] ?? null) !== 'product') {
                            continue;
                        }
                        $quantity = max(1, (int) ($lineItem['quantity'] ?? 1));
                        $selectedProduct = Product::query()->find((int) ($lineItem['item_id'] ?? 0));
                        if (!$selectedProduct?->isPhysical()) {
                            continue;
                        }

                        $selectedVariantId = (int) ($lineItem['selected_variant_id'] ?? 0);
                        if ($selectedVariantId > 0) {
                            $variantUpdated = ProductVariant::query()
                                ->whereKey($selectedVariantId)
                                ->where('product_id', $selectedProduct->id)
                                ->where('inventory_count', '>=', $quantity)
                                ->decrement('inventory_count', $quantity);

                            if ($variantUpdated === 0) {
                                throw new RuntimeException("{$selectedProduct->title} variant imeisha au haitoshi kwa quantity uliyochagua.");
                            }
                        }

                        $updated = Product::query()
                            ->whereKey($selectedProduct->id)
                            ->where('inventory_count', '>=', $quantity)
                            ->decrement('inventory_count', $quantity);

                        if ($updated === 0) {
                            throw new RuntimeException("{$selectedProduct->title} imeisha au haitoshi kwa quantity uliyochagua.");
                        }
                    }
                }

                $newOrder = Order::create([
                    'buyer_id'         => $buyer->id,
                    'merchant_id'      => $purchasable->merchant_id,
                    'product_id'       => $product?->id,
                    'variant_id'       => $selectedVariant?->id,
                    'variant_snapshot' => $selectedVariant ? [
                        'id' => $selectedVariant->id,
                        'name' => $selectedVariant->name,
                        'sku' => $selectedVariant->sku,
                        'attributes' => $selectedVariant->attributes ?? [],
                        'swatch_image_url' => $selectedVariant->swatch_image_url,
                    ] : null,
                    'bundle_item_selection' => !empty($selectedBundleItems) ? array_values($selectedBundleItems) : null,
                    'purchasable_type' => $validated['purchasable_type'],
                    'purchasable_id'   => $validated['purchasable_id'],
                    'order_kind'       => 'one_time',
                    'quantity'         => 1,
                    'unit_price'       => $purchasable instanceof Bundle && !empty($selectedBundleItems)
                        ? $totalPaid
                        : $this->resolveBasePrice($purchasable, $selectedVariant),
                    'total_paid'       => $totalPaid,
                    'payment_status'   => 'pending',
                    'is_inquiry'       => $isInquiry,
                    'inquiry_status'   => $isInquiry ? 'pending' : null,
                    'idempotency_key'  => $validated['idempotency_key'],
                    'transaction_ref'  => $transactionRef,
                    'account_phone'    => $accountPhone,
                    'payment_phone'    => $paymentPhone,
                    // Gateway tracking (multi-country, multi-gateway)
                    'payment_gateway'  => $gateway->getName(),
                    'country_code'     => $countryCode,
                    'expires_at'       => now()->addMinutes(30),
                ]);

                if ($product?->isPhysical() && isset($zone)) {
                    $isPickup = $zone->delivery_type === 'self_pickup';
                    
                    \App\Models\Delivery::create([
                        'order_id' => $newOrder->id,
                        'shipping_zone_id' => $zone->id,
                        'delivery_type' => $zone->delivery_type, // Explicitly set type
                        'shipping_hotspot_id' => $validated['shipping_hotspot_id'] ?? null,
                        'physical_address' => $isPickup ? null : ($validated['physical_address'] ?? null),
                        'latitude' => $validated['buyer_lat'] ?? $validated['latitude'] ?? null,
                        'longitude' => $validated['buyer_lng'] ?? $validated['longitude'] ?? null,
                        'delivery_status' => 'awaiting_boda',
                        'buyer_release_pin' => $isPickup ? null : str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT),
                        'pickup_pin' => $isPickup ? str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT) : null,
                    ]);
                }
                $this->initializeOrderChat($newOrder);

                if (!$isInquiry) {
                    $newOrder->update(['payment_status' => 'resolved_merchant_paid']);
                    app(\App\Services\EntitlementService::class)->grantForOrder($newOrder->fresh(['product']));

                    if ($validated['purchasable_type'] === 'subscription_plan') {
                        $plan = $newOrder->resolved_purchasable;
                        $end = match ($plan->billing_interval) {
                            'hourly' => now()->addHours((int) $plan->interval_count),
                            'daily' => now()->addDays((int) $plan->interval_count),
                            'weekly' => now()->addWeeks((int) $plan->interval_count),
                            default => now()->addMonths((int) $plan->interval_count),
                        };
                        $subscription = \App\Models\UserSubscription::create([
                            'user_id' => $newOrder->buyer_id,
                            'merchant_id' => $newOrder->merchant_id,
                            'subscription_plan_id' => $plan->id,
                            'status' => 'active',
                            'auto_renew' => true,
                            'started_at' => now(),
                            'current_period_start' => now(),
                            'current_period_end' => $end,
                            'next_billing_at' => $end,
                        ]);
                        app(\App\Services\EntitlementService::class)->grantForSubscription($subscription);
                    }
                }

                return $newOrder;
            });
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }

        $responsePayload = [
            'message' => $order->is_inquiry 
                ? 'Agizo lako limepokelewa! Sasa mnaweza kuwasiliana.'
                : 'Malipo yamefanikiwa! Sasa unaweza kuona maudhui yako.',
            'order'   => OrderResource::make($order->loadMissing('product')),
        ];

        // Auto-login guest buyer
        if (!$request->user()) {
            $buyer->tokens()->delete();
            $responsePayload['token'] = $buyer->createToken('takeer-app')->plainTextToken;
            Auth::login($buyer, true);
            $responsePayload['user'] = clone(\App\Http\Resources\UserResource::make($buyer));
        }

        return response()->json($responsePayload);
    }

    /**
     * POST /api/v1/orders/{order}/complete
     * Buyer confirms delivery. Escrow released to merchant.
     */
    public function complete(Order $order): JsonResponse
    {
        if ($order->buyer_id !== request()->user()->id) {
            abort(403);
        }

        if ($order->purchasable_type !== 'product' || !$order->product?->isPhysical()) {
            return response()->json(['message' => 'Agizo hili halihitaji hatua ya kukamilisha delivery.'], 400);
        }

        if (!$order->isEscrowLocked()) {
            return response()->json(['message' => 'Agizo hili halijafika katika hatua hii.'], 400);
        }

        DB::transaction(function () use ($order) {
            $order->update(['payment_status' => 'resolved_merchant_paid']);
            $wallet = $order->product->merchant->user->wallet()->firstOrCreate(
                ['user_id' => $order->product->merchant->user_id],
                ['balance' => 0, 'frozen_balance' => 0]
            );
            $wallet->increment('balance', $order->total_paid * 0.95);
            $wallet->decrement('frozen_balance', $order->total_paid);

            if ($order->product->isPhysical()) {
                $order->delivery()->update(['delivery_status' => 'delivered']);
            }
        });

        app(EntitlementService::class)->grantForOrder($order->fresh(['product']));

        return response()->json([
            'message' => 'Asante! Agizo lako limekamilika.',
            'order'   => $order->fresh(['delivery']),
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolvePurchasable(string $type, int $id): Product|Bundle|ContentItem|SubscriptionPlan|Post
    {
        return match ($type) {
            'product'           => Product::findOrFail($id),
            'bundle'            => Bundle::findOrFail($id),
            'content_item'      => ContentItem::findOrFail($id),
            'subscription_plan' => SubscriptionPlan::findOrFail($id),
            'post'              => Post::findOrFail($id),
        };
    }

    private function resolveBasePrice(Product|Bundle|ContentItem|SubscriptionPlan|Post $purchasable, ?ProductVariant $variant = null): float
    {
        if ($purchasable instanceof Product) {
            if ($variant) {
                return (float) ($variant->price ?? $purchasable->discounted_price ?? $purchasable->price);
            }
            return (float) ($purchasable->discounted_price ?? $purchasable->price);
        }
        if ($purchasable instanceof Post) {
            return (float) ($purchasable->restricted_price ?? 0);
        }
        return (float) ($purchasable->price ?? 0);
    }

    private function resolveBundleSelection(Bundle $bundle, array $selectedItems): array
    {
        if (empty($selectedItems)) {
            return [];
        }

        $bundleItems = $bundle->items()
            ->whereIn('item_type', ['product', 'content_item'])
            ->get(['id', 'item_type', 'item_id', 'selected_variant_id', 'selected_variant_snapshot']);
        $bundleKeys = $bundleItems->keyBy(fn ($item) => "{$item->item_type}:{$item->item_id}");

        $normalized = [];
        foreach ($selectedItems as $row) {
            $itemType = (string) ($row['item_type'] ?? '');
            $itemId = (int) ($row['item_id'] ?? 0);
            $quantity = max(1, (int) ($row['quantity'] ?? 1));
            $key = "{$itemType}:{$itemId}";

            $bundleItem = $bundleKeys->get($key);
            if (!$bundleItem) {
                throw new RuntimeException('One or more selected items are not part of this bundle.');
            }

            $requestedVariantId = (int) ($row['selected_variant_id'] ?? 0);
            $configuredVariantId = (int) ($bundleItem->selected_variant_id ?? 0);
            $effectiveVariantId = $configuredVariantId > 0 ? $configuredVariantId : $requestedVariantId;

            if ($configuredVariantId > 0 && $requestedVariantId > 0 && $requestedVariantId !== $configuredVariantId) {
                throw new RuntimeException('Selected variant does not match the bundle configuration.');
            }

            if (!isset($normalized[$key])) {
                $normalized[$key] = [
                    'bundle_item_id' => (int) $bundleItem->id,
                    'item_type' => $itemType,
                    'item_id' => $itemId,
                    'quantity' => 0,
                    'selected_variant_id' => $effectiveVariantId > 0 ? $effectiveVariantId : null,
                    'selected_variant_snapshot' => $bundleItem->selected_variant_snapshot,
                ];
            }
            $normalized[$key]['quantity'] += $quantity;
        }

        $productIds = collect($normalized)->where('item_type', 'product')->pluck('item_id')->values();
        $variantIds = collect($normalized)->where('item_type', 'product')->pluck('selected_variant_id')->filter()->values();
        $contentIds = collect($normalized)->where('item_type', 'content_item')->pluck('item_id')->values();
        $products = Product::query()
            ->whereIn('id', $productIds)
            ->with(['images:id,product_id,image_url,order'])
            ->get(['id', 'title', 'price', 'discounted_price', 'type'])
            ->keyBy('id');
        $variants = ProductVariant::query()
            ->whereIn('id', $variantIds)
            ->where('is_active', true)
            ->get(['id', 'product_id', 'name', 'sku', 'price', 'attributes', 'swatch_image_url'])
            ->keyBy('id');
        $contentItems = ContentItem::query()
            ->whereIn('id', $contentIds)
            ->get(['id', 'title', 'price'])
            ->keyBy('id');

        return collect($normalized)->map(function ($row) use ($products, $variants, $contentItems) {
            if ($row['item_type'] === 'product') {
                $product = $products->get($row['item_id']);
                if (!$product) {
                    throw new RuntimeException('Selected product is not available.');
                }
                $variant = null;
                if (!empty($row['selected_variant_id'])) {
                    $variant = $variants->get((int) $row['selected_variant_id']);
                    if (!$variant || (int) $variant->product_id !== (int) $product->id) {
                        throw new RuntimeException('Selected variant is unavailable for one of your chosen bundle items.');
                    }
                }

                $unitPrice = (float) ($variant?->price ?? $product->discounted_price ?? $product->price ?? 0);
                return [
                    'bundle_item_id' => (int) ($row['bundle_item_id'] ?? 0),
                    'item_type' => 'product',
                    'item_id' => (int) $product->id,
                    'title' => $product->title,
                    'quantity' => (int) $row['quantity'],
                    'unit_price' => $unitPrice,
                    'line_total' => $unitPrice * (int) $row['quantity'],
                    'image_url' => $variant?->swatch_image_url ?: $product->image_url,
                    'product_type' => $product->type,
                    'selected_variant_id' => $variant ? (int) $variant->id : null,
                    'selected_variant_snapshot' => $variant ? [
                        'id' => (int) $variant->id,
                        'name' => $variant->name,
                        'sku' => $variant->sku,
                        'price' => $variant->price !== null ? (float) $variant->price : null,
                        'attributes' => $variant->attributes ?? [],
                        'swatch_image_url' => $variant->swatch_image_url,
                    ] : ($row['selected_variant_snapshot'] ?? null),
                ];
            }

            $content = $contentItems->get($row['item_id']);
            if (!$content) {
                throw new RuntimeException('Selected content item is not available.');
            }
            $unitPrice = (float) ($content->price ?? 0);
            return [
                'bundle_item_id' => (int) ($row['bundle_item_id'] ?? 0),
                'item_type' => 'content_item',
                'item_id' => (int) $content->id,
                'title' => $content->title,
                'quantity' => (int) $row['quantity'],
                'unit_price' => $unitPrice,
                'line_total' => $unitPrice * (int) $row['quantity'],
                'image_url' => null,
                'product_type' => null,
                'selected_variant_id' => null,
                'selected_variant_snapshot' => null,
            ];
        })->values()->all();
    }

    /**
     * POST /api/v1/checkout/inquire
     * 
     * Creates a draft order (inquiry) for physical products when no shipping zones match.
     */
    public function inquire(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'purchasable_type' => 'required|in:product',
            'purchasable_id' => 'required|integer',
            'variant_id' => 'nullable|integer',
            'account_phone' => 'required|string',
            'buyer_name' => 'nullable|string|max:255',
            'physical_address' => 'required|string|min:3',
            'buyer_lat' => 'nullable|numeric',
            'buyer_lng' => 'nullable|numeric',
            'shipping_hotspot_id' => 'nullable|integer|exists:shipping_hotspots,id',
            'idempotency_key' => 'required|string|unique:orders,idempotency_key',
        ]);

        $product = Product::findOrFail($validated['purchasable_id']);
        if (!$product->isPhysical()) {
            return response()->json(['message' => 'Inquiries are only for physical products.'], 400);
        }

        $selectedVariant = null;
        if (!empty($validated['variant_id'])) {
            $selectedVariant = ProductVariant::where('product_id', $product->id)->findOrFail($validated['variant_id']);
        }

        // Resolve buyer
        $buyer = $request->user();
        if (!$buyer) {
            $buyer = \App\Models\User::firstOrCreate(
                ['phone_number' => $validated['account_phone']],
                ['name' => $validated['buyer_name'] ?? 'Guest Buyer', 'role' => 'buyer']
            );
        }

        $unitPrice = $this->resolveBasePrice($product, $selectedVariant);
        $transactionRef = 'INQ-' . Str::upper(Str::random(10));

        $order = DB::transaction(function () use ($buyer, $product, $selectedVariant, $unitPrice, $validated, $transactionRef) {
            $newOrder = Order::create([
                'buyer_id' => $buyer->id,
                'merchant_id' => $product->merchant_id,
                'product_id' => $product->id,
                'variant_id' => $selectedVariant?->id,
                'variant_snapshot' => $selectedVariant ? [
                    'id' => $selectedVariant->id,
                    'name' => $selectedVariant->name,
                    'sku' => $selectedVariant->sku,
                    'attributes' => $selectedVariant->attributes ?? [],
                    'swatch_image_url' => $selectedVariant->swatch_image_url,
                ] : null,
                'purchasable_type' => 'product',
                'purchasable_id' => $product->id,
                'order_kind' => 'one_time',
                'quantity' => 1,
                'unit_price' => $unitPrice,
                'total_paid' => $unitPrice, // Initial total without shipping
                'payment_status' => 'pending',
                'is_inquiry' => true,
                'inquiry_status' => 'pending',
                'idempotency_key' => $validated['idempotency_key'],
                'transaction_ref' => $transactionRef,
                'account_phone' => $validated['account_phone'],
                'payment_phone' => $validated['account_phone'],
                'expires_at' => now()->addMinutes(30),
            ]);

            \App\Models\Delivery::create([
                'order_id' => $newOrder->id,
                'shipping_zone_id' => null,
                'delivery_type' => 'shipping', // Explicitly set as shipping for inquiries
                'physical_address' => $validated['physical_address'] ?? null,
                'shipping_hotspot_id' => $validated['shipping_hotspot_id'] ?? null,
                'latitude' => $validated['buyer_lat'] ?? null,
                'longitude' => $validated['buyer_lng'] ?? null,
                'delivery_status' => 'inquiry',
            ]);

                $this->initializeOrderChat($newOrder);

                return $newOrder;
            });

        return response()->json([
            'message' => 'Inquiry created successfully.',
            'order' => OrderResource::make($order)->resolve(),
        ], 201);
    }

    /**
     * POST /api/v1/checkout/pay-inquiry/{order}
     * 
     * Initiates payment for an inquiry that has been quoted by the merchant.
     */
    public function payInquiry(Request $request, Order $order): JsonResponse
    {
        if (!$order->is_inquiry || $order->inquiry_status !== 'quoted') {
            return response()->json(['message' => 'Order is not ready for payment.'], 400);
        }

        if ($order->payment_status !== 'pending') {
            return response()->json(['message' => 'Payment has already been initiated or processed.'], 400);
        }

        $product = $order->product;
        $selectedVariant = $order->variant;

        $paymentPhone = $request->input('payment_number') ?? $order->payment_phone;

        // Verify inventory again before payment
        try {
            DB::transaction(function () use ($product, $selectedVariant, $order, $paymentPhone) {
                if ($selectedVariant) {
                    $updated = ProductVariant::query()
                        ->whereKey($selectedVariant->id)
                        ->where('inventory_count', '>', 0)
                        ->decrement('inventory_count');

                    Product::query()
                        ->whereKey($product->id)
                        ->where('inventory_count', '>', 0)
                        ->decrement('inventory_count');
                } else {
                    $updated = Product::query()
                        ->whereKey($product->id)
                        ->where('inventory_count', '>', 0)
                        ->decrement('inventory_count');
                }

                if ($updated === 0) {
                    throw new RuntimeException('Bidhaa hii imeisha.');
                }
                
                $order->update(['payment_phone' => $paymentPhone]);
            });
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }

        // Detect country + resolve gateway
        try {
            $gateway = $this->gatewayRegistry->resolve($request, $paymentPhone);
            $countryCode = $this->gatewayRegistry->resolveCountry($request, $paymentPhone);
            
            $order->update([
                'payment_gateway' => $gateway->getName(),
                'country_code' => $countryCode,
            ]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => 'Huduma ya malipo haipatikani kwa sasa.'], 422);
        }

        // Trigger gateway payment push
        try {
            $response = $gateway->initiatePayment($order->total_paid, $paymentPhone, $order->transaction_ref, [
                'full_name' => $order->buyer->name,
                'email' => $order->buyer->email,
                'order_id' => $order->id,
            ]);

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
                'reference' => 'SIM-' . strtoupper(Str::random(10)),
            ]);

            // Freeze funds in merchant's wallet simulation
            $wallet = $order->merchant->user->wallet()->firstOrCreate(['user_id' => $order->merchant->user_id], ['balance' => 0, 'frozen_balance' => 0]);
            $wallet->increment('frozen_balance', $order->total_paid);

            return response()->json([
                'message' => 'Malipo ya majaribio yamefanikiwa! Agizo limehifadhiwa (Escrow).',
                'order' => OrderResource::make($order->fresh())->resolve(),
            ]);

        } catch (RuntimeException $e) {
            Log::error('CheckoutController@payInquiry: Gateway error.', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Imeshindikana kuomba malipo kupitia mtandao wa simu. Jaribu tena.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    private function initializeOrderChat(Order $order): void
    {
        $merchantUser = $order->merchant->user;
        $buyerUser = $order->buyer;

        $body = "Habari, order mpya imewekwa kwa ajili ya: " . ($order->product->title ?? 'Bidhaa yako') . ".\n";
        
        if ($order->is_inquiry) {
            $body .= "Hii ni inquiry ya usafirishaji. Tafadhali thibitisha gharama ya usafiri kwa mteja.";
        } else {
            $body .= "Malipo yamefanikiwa na yamehifadhiwa (Escrow). Tafadhali anza mchakato wa kusafirisha.";
        }

        \App\Models\Message::create([
            'order_id'    => $order->id,
            'sender_id'   => $buyerUser->id,
            'receiver_id' => $merchantUser->id,
            'type'        => 'system',
            'body'        => $body,
        ]);
    }
}
