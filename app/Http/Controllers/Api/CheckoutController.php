<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Checkout\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\MarketingEvent;
use App\Models\Order;
use App\Models\MerchantCoupon;
use App\Models\MerchantReferralLink;
use App\Models\MerchantGroupSaleCampaign;
use App\Models\Post;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ServiceRequest;
use App\Models\ShippingZone;
use App\Models\SubscriptionPlan;
use App\Payments\GatewayRegistry;
use App\Services\EntitlementService;
use App\Services\SmsService;
use App\Services\SubscriptionRenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class CheckoutController extends Controller
{
    public function __construct(
        private readonly GatewayRegistry $gatewayRegistry,
        private readonly SmsService $smsService,
    ) {
    }

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
        $product = $purchasable instanceof Product ? $purchasable : null;
        $selectedVariant = null;
        $selectedBundleItems = [];
        $serviceRequest = null;
        $requestedQuantity = 1.0;

        if ($product?->isService() && !empty($validated['service_request_id'])) {
            $serviceRequest = ServiceRequest::query()
                ->where('product_id', $product->id)
                ->findOrFail((int) $validated['service_request_id']);

            if (
                !$serviceRequest->payment_token
                || !hash_equals((string) $serviceRequest->payment_token, (string) ($validated['service_request_token'] ?? ''))
                || !in_array($serviceRequest->status, ['quoted', 'confirmed'], true)
                || (float) $serviceRequest->quoted_amount <= 0
                || in_array($serviceRequest->payment_status, ['paid', 'held', 'released', 'disputed', 'payment_initiated'], true)
                || ($serviceRequest->payment_link_expires_at && $serviceRequest->payment_link_expires_at->isPast())
            ) {
                return response()->json(['message' => 'Service payment link is invalid or expired.'], 422);
            }
        }

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

        if ($product?->isPhysical()) {
            $product->loadMissing(['unitType', 'packageContentUnitType']);
            $requestedQuantity = max(0.001, (float) ($validated['quantity'] ?? 1));
            $minimumQuantity = max(0.001, (float) ($product->min_order_quantity ?: 1));

            if ($requestedQuantity < $minimumQuantity) {
                return response()->json(['message' => "Kiasi cha chini ni {$minimumQuantity} " . ($product->unitType?->symbol ?: $product->unitType?->name ?: 'units') . '.'], 422);
            }

            if ($product->unitType && !$product->unitType->allows_decimal && floor($requestedQuantity) != $requestedQuantity) {
                return response()->json(['message' => 'Bidhaa hii inauzwa kwa idadi kamili tu.'], 422);
            }
        }

        // ── Calculate total payable ───────────────────────────────────────────
        $servicePricingInputs = $validated['service_pricing_inputs'] ?? [];
        if ($product?->type === 'service' && !$serviceRequest) {
            $pricingError = $this->validateServicePricingInputs($product, $servicePricingInputs);
            if ($pricingError) {
                return response()->json(['message' => $pricingError], 422);
            }
        }
        $totalPaid = $this->resolveBasePrice($purchasable, $selectedVariant, $servicePricingInputs);
        if ($product?->isPhysical()) {
            $totalPaid = round($totalPaid * $requestedQuantity, 2);
        }
        $groupSaleCampaign = null;
        if ($product && !empty($validated['group_sale_campaign_id'])) {
            $groupSaleCampaign = $this->resolveGroupSaleCampaign(
                (int) $validated['group_sale_campaign_id'],
                $product
            );
            $totalPaid = (float) $groupSaleCampaign->campaign_price;
            if ($product->isPhysical()) {
                $totalPaid = round($totalPaid * $requestedQuantity, 2);
            }
        }
        if ($serviceRequest) {
            $totalPaid = (float) $serviceRequest->quoted_amount;
        }
        if ($purchasable instanceof Bundle) {
            try {
                $requestedBundleItems = $validated['selected_bundle_items'] ?? [];
                $selectedBundleItems = $this->resolveBundleSelection(
                    $purchasable,
                    !empty($requestedBundleItems) ? $requestedBundleItems : $this->fixedBundleSelectionRows($purchasable),
                    !empty($requestedBundleItems) ? 'menu_selection' : 'full_bundle',
                );
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 400);
            }
            if (!empty($requestedBundleItems)) {
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

        $coupon = null;
        $discountAmount = 0.0;
        if (!empty($validated['coupon_code'])) {
            [$coupon, $discountAmount] = $this->resolveCouponDiscount(
                code: (string) $validated['coupon_code'],
                merchantId: (int) $purchasable->merchant_id,
                buyerId: (int) $buyer->id,
                purchasableType: (string) $validated['purchasable_type'],
                purchasableId: (int) $validated['purchasable_id'],
                subtotal: (float) $totalPaid
            );
            $totalPaid = max(0, round($totalPaid - $discountAmount, 2));
        }

        $referralLink = $this->resolveReferralLink(
            code: (string) ($validated['referral_code'] ?? $request->cookie('takeer_referral_code', '')),
            merchantId: (int) $purchasable->merchant_id,
            purchasableType: (string) $validated['purchasable_type'],
            purchasableId: (int) $validated['purchasable_id']
        );
        $referralCommissionAmount = $referralLink
            ? $this->calculateReferralCommission($referralLink, (float) $totalPaid)
            : 0.0;

        // ── Detect country + resolve gateway ──────────────────────────────────
        $phoneNumber = $paymentPhone;

        try {
            $gateway = $this->gatewayRegistry->resolve($request, $phoneNumber);
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
            $order = DB::transaction(function () use ($buyer, $product, $selectedVariant, $purchasable, $totalPaid, $validated, $requestedQuantity, $transactionRef, $gateway, $countryCode, $accountPhone, $paymentPhone, $selectedBundleItems, $zone, $deliveryType, $isInquiry, $serviceRequest, $servicePricingInputs, $coupon, $discountAmount, $referralLink, $referralCommissionAmount, $groupSaleCampaign) {
                $productInventoryReserved = false;

                if ($product?->isPhysical()) {
                    $reservedUnits = (int) ceil($requestedQuantity);
                    if ($selectedVariant) {
                        $updated = ProductVariant::query()
                            ->whereKey($selectedVariant->id)
                            ->where('inventory_count', '>=', $reservedUnits)
                            ->decrement('inventory_count', $reservedUnits);

                        ProductVariant::query()
                            ->whereKey($selectedVariant->id)
                            ->where('inventory_quantity', '>=', $requestedQuantity)
                            ->decrement('inventory_quantity', $requestedQuantity);

                        Product::query()
                            ->whereKey($product->id)
                            ->where('inventory_count', '>=', $reservedUnits)
                            ->decrement('inventory_count', $reservedUnits);

                        Product::query()
                            ->whereKey($product->id)
                            ->where('inventory_quantity', '>=', $requestedQuantity)
                            ->decrement('inventory_quantity', $requestedQuantity);

                        $this->decrementLocationInventory($product->id, $selectedVariant->id, $requestedQuantity, $product->merchant_id);
                    } else {
                        $updated = Product::query()
                            ->whereKey($product->id)
                            ->where('inventory_count', '>=', $reservedUnits)
                            ->decrement('inventory_count', $reservedUnits);

                        Product::query()
                            ->whereKey($product->id)
                            ->where('inventory_quantity', '>=', $requestedQuantity)
                            ->decrement('inventory_quantity', $requestedQuantity);

                        $this->decrementLocationInventory($product->id, null, $requestedQuantity, $product->merchant_id);
                    }

                    if ($updated === 0) {
                        throw new RuntimeException('Bidhaa hii imeisha.');
                    }

                    $productInventoryReserved = true;
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

                        $this->decrementLocationInventory($selectedProduct->id, $selectedVariantId > 0 ? $selectedVariantId : null, $quantity, $selectedProduct->merchant_id);
                        $productInventoryReserved = true;
                    }
                }

                $newOrder = Order::create([
                    'buyer_id' => $buyer->id,
                    'merchant_id' => $purchasable->merchant_id,
                    'product_id' => $product?->id,
                    'variant_id' => $selectedVariant?->id,
                    'variant_snapshot' => $selectedVariant ? [
                        'id' => $selectedVariant->id,
                        'name' => $selectedVariant->name,
                        'sku' => $selectedVariant->sku,
                        'attributes' => $selectedVariant->attributes ?? [],
                        'swatch_image_url' => $selectedVariant->swatch_image_url,
                    ] : null,
                    'bundle_item_selection' => !empty($selectedBundleItems) ? array_values($selectedBundleItems) : null,
                    'purchasable_type' => $validated['purchasable_type'],
                    'purchasable_id' => $validated['purchasable_id'],
                    'order_kind' => 'one_time',
                    'quantity' => $product?->isPhysical() ? (int) ceil($requestedQuantity) : 1,
                    'requested_quantity' => $product?->isPhysical() ? $requestedQuantity : 1,
                    'product_unit_type_id' => $product?->product_unit_type_id,
                    'unit_snapshot' => $product?->product_unit_type_id ? [
                        'unit_type_id' => $product->product_unit_type_id,
                        'name' => $product->unitType?->name,
                        'code' => $product->unitType?->code,
                        'symbol' => $product->unitType?->symbol,
                        'sellable_quantity' => (float) ($product->sellable_quantity ?: 1),
                        'quantity_represents_packages' => true,
                        'package_content_quantity' => $product->package_content_quantity !== null ? (float) $product->package_content_quantity : null,
                        'package_content_unit_type' => $product->package_content_unit_type_id ? [
                            'unit_type_id' => $product->package_content_unit_type_id,
                            'name' => $product->packageContentUnitType?->name,
                            'code' => $product->packageContentUnitType?->code,
                            'symbol' => $product->packageContentUnitType?->symbol,
                        ] : null,
                        'package_contents' => $product->package_contents,
                        'package_content_items' => $product->package_content_items ?: [],
                    ] : null,
                    'unit_price' => $purchasable instanceof Bundle && !empty($selectedBundleItems)
                        ? $totalPaid + $discountAmount
                        : ($serviceRequest ? (float) $serviceRequest->quoted_amount : $this->resolveBasePrice($purchasable, $selectedVariant, $servicePricingInputs)),
                    'discount_amount' => $discountAmount,
                    'merchant_coupon_id' => $coupon?->id,
                    'coupon_code' => $coupon?->code,
                    'merchant_referral_link_id' => $referralLink?->id,
                    'group_sale_campaign_id' => $groupSaleCampaign?->id,
                    'referral_code' => $referralLink?->code,
                    'referral_commission_amount' => $isInquiry ? 0 : $referralCommissionAmount,
                    'referral_commission_status' => (!$isInquiry && $referralCommissionAmount > 0) ? 'pending' : null,
                    'referral_reward_snapshot' => (!$isInquiry && $referralLink) ? [
                        'reward_type' => $referralLink->reward_type,
                        'reward_value' => (float) $referralLink->reward_value,
                        'calculated_from' => $totalPaid,
                    ] : null,
                    'total_paid' => $totalPaid,
                    'payment_status' => 'pending',
                    'is_inquiry' => $isInquiry,
                    'inquiry_status' => $isInquiry ? 'pending' : null,
                    'idempotency_key' => $validated['idempotency_key'],
                    'transaction_ref' => $transactionRef,
                    'account_phone' => $accountPhone,
                    'payment_phone' => $paymentPhone,
                    'payment_page_id' => $validated['payment_page_id'] ?? null,
                    // Gateway tracking (multi-country, multi-gateway)
                    'payment_gateway' => $gateway->getName(),
                    'country_code' => $countryCode,
                    'expires_at' => now()->addMinutes(30),
                ]);

                if (!empty($productInventoryReserved)) {
                    $newOrder->forceFill(['inventory_reserved_at' => now()])->saveQuietly();
                }

                if ($serviceRequest) {
                    $serviceRequest->update([
                        'buyer_id' => $buyer->id,
                        'payment_status' => 'payment_initiated',
                        'payment_order_id' => $newOrder->id,
                        'status' => $serviceRequest->status === 'quoted' ? 'confirmed' : $serviceRequest->status,
                    ]);
                }

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
                        'delivery_status' => $isPickup ? 'awaiting_pickup' : 'awaiting_boda',
                        'buyer_release_pin' => $isPickup ? null : str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT),
                        'pickup_pin' => $isPickup ? str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT) : null,
                    ]);
                }
                $this->initializeOrderChat($newOrder);

                if ($coupon && $discountAmount > 0) {
                    $coupon->increment('times_used');
                }

                if (!$isInquiry) {
                    $isCustomDelivery = $product?->isDigital()
                        && ($product->digital_delivery_type ?? null) === 'custom_delivery';
                    $newOrder->update([
                        'payment_status' => ($serviceRequest || $newOrder->requiresPhysicalFulfillment() || $isCustomDelivery) ? 'escrow_locked' : 'resolved_merchant_paid',
                        'custom_delivery_due_at' => $isCustomDelivery ? $newOrder->customDeliveryDueAtFrom() : null,
                    ]);
                    if (!$newOrder->requiresPhysicalFulfillment()) {
                        app(\App\Services\EntitlementService::class)->grantForOrder($newOrder->fresh(['product']));
                    }
                    if ($serviceRequest) {
                        $serviceRequest->update([
                            'payment_status' => 'held',
                            'delivery_status' => 'scheduled',
                            'status' => 'confirmed',
                        ]);
                    }

                    if ($validated['purchasable_type'] === 'subscription_plan') {
                        $subscription = app(SubscriptionRenewalService::class)->createOrExtendFromOrder($newOrder);
                        app(\App\Services\EntitlementService::class)->grantForSubscription($subscription);
                    }
                }

                return $newOrder;
            });
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }

        $this->recordCheckoutAttribution($request, $order, $validated, $referralLink);
        $this->sendDigitalAccessSmsIfPaid($order);

        $responsePayload = [
            'message' => $order->is_inquiry
                ? 'Agizo lako limepokelewa! Sasa mnaweza kuwasiliana.'
                : ($serviceRequest
                    ? 'Malipo yamehifadhiwa SafePay. Thibitisha huduma ikitolewa.'
                    : 'Malipo yamefanikiwa! Sasa unaweza kuona maudhui yako.'),
            'order' => OrderResource::make($order->loadMissing('product')),
        ];

        // Auto-login guest buyer
        if (!$request->user()) {
            $buyer->tokens()->delete();
            $responsePayload['token'] = $buyer->createToken('takeer-app')->plainTextToken;
            Auth::login($buyer, true);
            $responsePayload['user'] = clone (\App\Http\Resources\UserResource::make($buyer));
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

        if (!$order->requiresPhysicalFulfillment()) {
            return response()->json(['message' => 'Agizo hili halihitaji hatua ya kukamilisha delivery.'], 400);
        }

        if (!$order->isEscrowLocked()) {
            return response()->json(['message' => 'Agizo hili halijafika katika hatua hii.'], 400);
        }

        DB::transaction(function () use ($order) {
            $order->update(['payment_status' => 'resolved_merchant_paid']);
            $netAmount = \App\Models\Transaction::query()
                ->where('order_id', $order->id)
                ->where('type', 'order_revenue')
                ->latest()
                ->value('net_amount')
                ?? app(\App\Services\FeePolicyService::class)->calculateForOrder($order, (float) $order->total_paid)['net_amount'];
            $wallet = $order->merchant->wallet()->firstOrCreate(
                ['merchant_id' => $order->merchant_id],
                ['user_id' => $order->merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
            );
            $wallet->increment('balance', $netAmount);
            $wallet->decrement('frozen_balance', $order->total_paid);

            if ($order->delivery) {
                $order->delivery()->update(['delivery_status' => 'delivered']);
            }
        });

        app(EntitlementService::class)->grantForOrder($order->fresh(['product']));

        return response()->json([
            'message' => 'Asante! Agizo lako limekamilika.',
            'order' => $order->fresh(['delivery']),
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolvePurchasable(string $type, int $id): Product|Bundle|ContentItem|SubscriptionPlan|Post
    {
        return match ($type) {
            'product' => Product::findOrFail($id),
            'bundle' => Bundle::findOrFail($id),
            'content_item' => ContentItem::findOrFail($id),
            'subscription_plan' => SubscriptionPlan::findOrFail($id),
            'post' => Post::findOrFail($id),
        };
    }

    private function resolveBasePrice(Product|Bundle|ContentItem|SubscriptionPlan|Post $purchasable, ?ProductVariant $variant = null, array $servicePricingInputs = []): float
    {
        if ($purchasable instanceof Product) {
            if ($variant) {
                return (float) ($variant->price ?? $purchasable->discounted_price ?? $purchasable->price);
            }
            $basePrice = (float) ($purchasable->discounted_price ?? $purchasable->price);
            if ($purchasable->type !== 'service') {
                return $basePrice;
            }

            $selectedOption = $this->selectedServiceOption($purchasable, $servicePricingInputs);
            if ($selectedOption) {
                $optionPrice = $selectedOption['price'] ?? null;
                if ($optionPrice !== null && $optionPrice !== '') {
                    $basePrice = (float) $optionPrice;
                }
            }
            $baseUnit = $selectedOption['price_display'] ?? $purchasable->service_price_display;

            $total = $basePrice * $this->servicePricingMultiplier($baseUnit, $servicePricingInputs);
            foreach (($purchasable->service_charges ?? []) as $charge) {
                $charge = (array) $charge;
                if (!($charge['included_in_checkout'] ?? false)) {
                    continue;
                }

                $amount = (float) ($charge['amount'] ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $total += $amount * $this->servicePricingMultiplier($charge['unit'] ?? 'fixed', $servicePricingInputs);
            }

            return (float) max(0, $total);
        }
        if ($purchasable instanceof Post) {
            return (float) ($purchasable->restricted_price ?? 0);
        }
        return (float) ($purchasable->price ?? 0);
    }

    private function resolveCouponDiscount(
        string $code,
        int $merchantId,
        int $buyerId,
        string $purchasableType,
        int $purchasableId,
        float $subtotal
    ): array {
        $normalizedCode = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $code));
        if ($normalizedCode === '') {
            throw new RuntimeException('Coupon code is invalid.');
        }

        $coupon = MerchantCoupon::query()
            ->where('merchant_id', $merchantId)
            ->where('code', $normalizedCode)
            ->first();

        if (!$coupon || !$coupon->isActiveNow()) {
            throw new RuntimeException('Coupon code is not active or has expired.');
        }

        if (!$coupon->appliesTo($purchasableType, $purchasableId)) {
            throw new RuntimeException('Coupon code does not apply to this offer.');
        }

        if ($coupon->usage_limit_per_customer !== null) {
            $customerUses = Order::query()
                ->where('buyer_id', $buyerId)
                ->where('merchant_coupon_id', $coupon->id)
                ->whereNotIn('payment_status', ['failed', 'cancelled'])
                ->count();

            if ($customerUses >= $coupon->usage_limit_per_customer) {
                throw new RuntimeException('You have already used this coupon code.');
            }
        }

        $discount = $coupon->calculateDiscount($subtotal);
        if ($discount <= 0) {
            throw new RuntimeException('Coupon code cannot be applied to this order total.');
        }

        return [$coupon, $discount];
    }

    private function resolveReferralLink(
        string $code,
        int $merchantId,
        string $purchasableType,
        int $purchasableId
    ): ?MerchantReferralLink {
        $normalizedCode = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $code));
        if ($normalizedCode === '') {
            return null;
        }

        $link = MerchantReferralLink::query()
            ->where('code', $normalizedCode)
            ->first();

        if (!$link?->isActiveNow()) {
            return null;
        }

        return $link->matchesPurchase($purchasableType, $purchasableId, $merchantId) ? $link : null;
    }

    private function recordCheckoutAttribution(Request $request, Order $order, array $validated, ?MerchantReferralLink $referralLink): void
    {
        $sessionId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) ($validated['attribution_session_id'] ?? $request->cookie('takeer_attribution_session', '')));
        if ($sessionId === '') {
            $sessionId = 'atk_' . Str::random(32);
        }

        $recentSmsClick = MarketingEvent::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('session_id', Str::limit($sessionId, 80, ''))
            ->where('event_type', 'sms_click')
            ->latest()
            ->first();

        $basePayload = [
            'merchant_id' => $order->merchant_id,
            'user_id' => $order->buyer_id,
            'order_id' => $order->id,
            'session_id' => Str::limit($sessionId, 80, ''),
            'entity_type' => $order->purchasable_type,
            'entity_id' => $order->purchasable_id,
            'source' => $validated['attribution_source'] ?? $recentSmsClick?->source,
            'landing_url' => $validated['landing_url'] ?? null,
            'referrer_url' => $validated['referrer_url'] ?? $request->headers->get('referer'),
            'utm_source' => $validated['utm_source'] ?? $recentSmsClick?->utm_source,
            'utm_medium' => $validated['utm_medium'] ?? $recentSmsClick?->utm_medium,
            'utm_campaign' => $validated['utm_campaign'] ?? $recentSmsClick?->utm_campaign,
            'utm_content' => $validated['utm_content'] ?? $recentSmsClick?->utm_content,
            'utm_term' => $validated['utm_term'] ?? null,
            'merchant_referral_link_id' => $referralLink?->id,
            'referral_code' => $referralLink?->code ?: ($validated['referral_code'] ?? $request->cookie('takeer_referral_code')),
            'coupon_code' => $order->coupon_code,
            'value' => $order->total_paid,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 1000, ''),
            'metadata' => [
                'payment_status' => $order->payment_status,
                'is_inquiry' => (bool) $order->is_inquiry,
                'payment_gateway' => $order->payment_gateway,
                'country_code' => $order->country_code,
            ],
        ];

        $checkoutStartId = MarketingEvent::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('session_id', $basePayload['session_id'])
            ->where('event_type', 'checkout_started')
            ->where('entity_type', $order->purchasable_type)
            ->where('entity_id', $order->purchasable_id)
            ->whereNull('order_id')
            ->latest()
            ->value('id');

        if ($checkoutStartId) {
            MarketingEvent::query()->whereKey($checkoutStartId)->update([
                'order_id' => $order->id,
                'user_id' => $order->buyer_id,
            ]);
        }

        MarketingEvent::query()
            ->where('merchant_id', $order->merchant_id)
            ->where('session_id', $basePayload['session_id'])
            ->whereNull('user_id')
            ->update(['user_id' => $order->buyer_id]);

        MarketingEvent::query()->create($basePayload + ['event_type' => 'checkout_completed']);
    }

    private function sendDigitalAccessSmsIfPaid(Order $order): void
    {
        if (!in_array($order->payment_status, ['resolved_merchant_paid', 'escrow_locked'], true)) {
            return;
        }

        $order->loadMissing(['buyer', 'product']);
        if (!$order->product || !($order->product->isDigital() || $order->product->isService())) {
            return;
        }

        $phone = $order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone;
        if (!$phone) {
            return;
        }

        $this->smsService->sendDigitalDeliveryNotification(
            $phone,
            (string) $order->product->title,
            url('/orders'),
            $order->buyer_id,
            'digital-delivery:' . ($order->public_id ?: $order->id)
        );
    }

    private function resolveGroupSaleCampaign(int $campaignId, Product $product): MerchantGroupSaleCampaign
    {
        $campaign = MerchantGroupSaleCampaign::query()
            ->whereKey($campaignId)
            ->where('product_id', $product->id)
            ->where('merchant_id', $product->merchant_id)
            ->first();

        if (!$campaign || !in_array($campaign->status, ['successful', 'active'], true)) {
            throw new RuntimeException('Group-sale campaign is not available for checkout.');
        }

        if ($campaign->ends_at->isPast()) {
            throw new RuntimeException('Group-sale campaign has expired.');
        }

        if ($campaign->status !== 'successful' && $campaign->reserved_quantity < $campaign->goal_quantity) {
            throw new RuntimeException('Group-sale target has not been reached yet.');
        }

        return $campaign;
    }

    private function calculateReferralCommission(MerchantReferralLink $link, float $totalPaid): float
    {
        $amount = match ($link->reward_type) {
            'percent' => $totalPaid * ((float) $link->reward_value / 100),
            'fixed' => (float) $link->reward_value,
            default => 0,
        };

        return round(max(0, min($totalPaid, $amount)), 2);
    }

    private function servicePricingMultiplier(?string $unit, array $inputs): float
    {
        return match ($unit) {
            'hourly' => max(1, (float) ($inputs['hours'] ?? 1)),
            'daily' => max(1, $this->dateSpanUnits($inputs, 'days')),
            'nightly' => max(1, $this->dateSpanUnits($inputs, 'nights')),
            'weekly' => max(1, (int) ceil($this->dateSpanUnits($inputs, 'days') / 7)),
            'monthly' => max(1, (int) ceil($this->dateSpanUnits($inputs, 'days') / 30)),
            'yearly' => max(1, (int) ceil($this->dateSpanUnits($inputs, 'days') / 365)),
            'per_person' => max(1, (int) ($inputs['people'] ?? 1)),
            'per_visit', 'per_session', 'per_project' => max(1, (int) ($inputs['quantity'] ?? 1)),
            default => 1,
        };
    }

    private function dateSpanUnits(array $inputs, string $mode): int
    {
        if (empty($inputs['start_date']) || empty($inputs['end_date'])) {
            return 1;
        }

        try {
            $start = \Carbon\Carbon::parse($inputs['start_date'])->startOfDay();
            $end = \Carbon\Carbon::parse($inputs['end_date'])->startOfDay();
            $days = max(1, $start->diffInDays($end, false));

            return $mode === 'nights' ? $days : $days + 1;
        } catch (\Throwable) {
            return 1;
        }
    }

    private function validateServicePricingInputs(Product $product, array $inputs): ?string
    {
        if (!empty($inputs['service_option_id']) && !$this->selectedServiceOption($product, $inputs)) {
            return 'Chaguo la huduma halipatikani. Tafadhali chagua tena.';
        }

        $units = collect([$product->service_price_display])
            ->when($this->selectedServiceOption($product, $inputs), function ($units, $option) {
                return $units->push($option['price_display'] ?? null);
            })
            ->merge(collect($product->service_charges ?? [])
                ->filter(fn($charge) => (bool) (((array) $charge)['included_in_checkout'] ?? false))
                ->map(fn($charge) => ((array) $charge)['unit'] ?? 'fixed'))
            ->filter()
            ->values();

        if ($units->contains('per_person') && (int) ($inputs['people'] ?? 0) < 1) {
            return 'Tafadhali weka idadi ya watu/wageni.';
        }

        if ($units->contains('hourly') && (float) ($inputs['hours'] ?? 0) <= 0) {
            return 'Tafadhali weka idadi ya saa.';
        }

        if ($units->intersect(['per_visit', 'per_session', 'per_project'])->isNotEmpty() && (int) ($inputs['quantity'] ?? 0) < 1) {
            return 'Tafadhali weka quantity ya huduma.';
        }

        if ($units->intersect(['daily', 'nightly', 'weekly', 'monthly', 'yearly'])->isNotEmpty()) {
            if (empty($inputs['start_date']) || empty($inputs['end_date'])) {
                return 'Tafadhali chagua tarehe ya kuanza na kumaliza.';
            }

            try {
                if (!\Carbon\Carbon::parse($inputs['end_date'])->startOfDay()->gt(\Carbon\Carbon::parse($inputs['start_date'])->startOfDay())) {
                    return 'Tarehe ya kumaliza lazima iwe baada ya tarehe ya kuanza.';
                }
            } catch (\Throwable) {
                return 'Tafadhali chagua tarehe sahihi.';
            }
        }

        return null;
    }

    private function selectedServiceOption(Product $product, array $inputs): ?array
    {
        $optionId = (string) ($inputs['service_option_id'] ?? '');
        if ($optionId === '') {
            return null;
        }

        $option = collect($product->service_options ?? [])
            ->first(fn($item) => (string) (((array) $item)['id'] ?? '') === $optionId);

        return $option ? (array) $option : null;
    }

    private function fixedBundleSelectionRows(Bundle $bundle): array
    {
        return $bundle->items()
            ->whereIn('item_type', ['product', 'content_item'])
            ->get(['item_type', 'item_id', 'selected_variant_id'])
            ->map(fn($item) => [
                'item_type' => $item->item_type,
                'item_id' => (int) $item->item_id,
                'selected_variant_id' => $item->selected_variant_id !== null ? (int) $item->selected_variant_id : null,
                'quantity' => 1,
            ])
            ->values()
            ->all();
    }

    private function resolveBundleSelection(Bundle $bundle, array $selectedItems, string $selectionMode = 'menu_selection'): array
    {
        if (empty($selectedItems)) {
            return [];
        }

        $bundleItems = $bundle->items()
            ->whereIn('item_type', ['product', 'content_item'])
            ->get(['id', 'item_type', 'item_id', 'selected_variant_id', 'selected_variant_snapshot']);
        $bundleKeys = $bundleItems->keyBy(fn($item) => "{$item->item_type}:{$item->item_id}");

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
            ->get(['id', 'title', 'price', 'discounted_price', 'type', 'has_variants', 'inventory_count'])
            ->keyBy('id');
        $variants = ProductVariant::query()
            ->whereIn('id', $variantIds)
            ->where('is_active', true)
            ->get(['id', 'product_id', 'name', 'sku', 'price', 'inventory_count', 'attributes', 'swatch_image_url'])
            ->keyBy('id');
        $contentItems = ContentItem::query()
            ->whereIn('id', $contentIds)
            ->get(['id', 'title', 'price'])
            ->keyBy('id');

        return collect($normalized)->map(function ($row) use ($products, $variants, $contentItems, $selectionMode) {
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
                if ($product->has_variants && !$variant) {
                    throw new RuntimeException("{$product->title} requires a specific variant before it can be sold in a bundle.");
                }
                if ($product->type === 'physical') {
                    $quantity = (int) $row['quantity'];
                    if ($variant && (int) $variant->inventory_count < $quantity) {
                        throw new RuntimeException("{$product->title} variant imeisha au haitoshi kwa bundle hii.");
                    }
                    if ((int) $product->inventory_count < $quantity) {
                        throw new RuntimeException("{$product->title} imeisha au haitoshi kwa bundle hii.");
                    }
                }

                $unitPrice = (float) ($variant?->price ?? $product->discounted_price ?? $product->price ?? 0);
                return [
                    'bundle_item_id' => (int) ($row['bundle_item_id'] ?? 0),
                    'selection_mode' => $selectionMode,
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
                'selection_mode' => $selectionMode,
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
     * Creates a draft order (inquiry) for physical fulfillment or quote-first services.
     * Also handles self-pickup orders via delivery_type=self_pickup.
     */
    public function inquire(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'purchasable_type' => 'required|in:product,bundle',
            'purchasable_id' => 'required|integer',
            'variant_id' => 'nullable|integer',
            'selected_bundle_items' => 'nullable|array',
            'selected_bundle_items.*.item_type' => 'required_with:selected_bundle_items|string|in:product,content_item',
            'selected_bundle_items.*.item_id' => 'required_with:selected_bundle_items|integer|min:1',
            'selected_bundle_items.*.selected_variant_id' => 'nullable|integer|exists:product_variants,id',
            'selected_bundle_items.*.quantity' => 'nullable|integer|min:1|max:99',
            'quantity' => 'nullable|numeric|min:0.001|max:100000',
            'account_phone' => 'required|string',
            'buyer_name' => 'nullable|string|max:255',
            'delivery_type' => 'nullable|in:shipping,self_pickup',
            'delivery_zone_id' => 'nullable|integer|exists:shipping_zones,id',
            'physical_address' => 'nullable|string|min:3',
            'buyer_lat' => 'nullable|numeric',
            'buyer_lng' => 'nullable|numeric',
            'shipping_hotspot_id' => 'nullable|integer|exists:shipping_hotspots,id',
            'idempotency_key' => 'required|string|unique:orders,idempotency_key',
            'group_sale_campaign_id' => 'nullable|integer|exists:merchant_group_sale_campaigns,id',
            'service_pricing_inputs' => 'nullable|array',
            'service_pricing_inputs.service_option_id' => 'nullable|string|max:80',
            'service_pricing_inputs.people' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.hours' => 'nullable|numeric|min:0.25|max:100000',
            'service_pricing_inputs.quantity' => 'nullable|integer|min:1|max:100000',
            'service_pricing_inputs.start_date' => 'nullable|date',
            'service_pricing_inputs.end_date' => 'nullable|date|after:service_pricing_inputs.start_date',
        ]);

        $deliveryType = $validated['delivery_type'] ?? 'shipping';
        $isSelfPickup = $deliveryType === 'self_pickup';
        $servicePricingInputs = $validated['service_pricing_inputs'] ?? [];

        $isServiceInquiry = false;
        $product = null;
        $bundle = null;
        $selectedBundleItems = [];
        $selectedVariant = null;
        $requestedQuantity = 1.0;
        if ($validated['purchasable_type'] === 'product') {
            $product = Product::with(['unitType', 'packageContentUnitType'])->findOrFail($validated['purchasable_id']);
            $isServiceInquiry = $product->isService() && (
                ($product->service_mode ?? null) === 'request_quote'
                || ($product->service_pricing_model ?? null) === 'contract_quote'
                || ($product->service_price_display ?? null) === 'quote_only'
            );

            if (!$product->isPhysical() && !$isServiceInquiry) {
                return response()->json(['message' => 'Inquiries are only for physical products, physical bundles, or quote-first services.'], 400);
            }

            if ($product->isPhysical()) {
                $requestedQuantity = max(0.001, (float) ($validated['quantity'] ?? 1));
                $minimumQuantity = max(0.001, (float) ($product->min_order_quantity ?: 1));
                if ($requestedQuantity < $minimumQuantity) {
                    return response()->json(['message' => "Kiasi cha chini ni {$minimumQuantity} " . ($product->unitType?->symbol ?: $product->unitType?->name ?: 'units') . '.'], 422);
                }
                if ($product->unitType && !$product->unitType->allows_decimal && floor($requestedQuantity) != $requestedQuantity) {
                    return response()->json(['message' => 'Bidhaa hii inauzwa kwa idadi kamili tu.'], 422);
                }

                if (!empty($validated['variant_id'])) {
                    $selectedVariant = ProductVariant::where('product_id', $product->id)->findOrFail($validated['variant_id']);
                }
            } elseif (!empty($servicePricingInputs['service_option_id']) && !$this->selectedServiceOption($product, $servicePricingInputs)) {
                return response()->json(['message' => 'Chaguo la huduma halipatikani. Tafadhali chagua tena.'], 422);
            }
        } else {
            $bundle = Bundle::findOrFail($validated['purchasable_id']);
            try {
                $requestedBundleItems = $validated['selected_bundle_items'] ?? [];
                $selectedBundleItems = $this->resolveBundleSelection(
                    $bundle,
                    !empty($requestedBundleItems) ? $requestedBundleItems : $this->fixedBundleSelectionRows($bundle),
                    !empty($requestedBundleItems) ? 'menu_selection' : 'full_bundle',
                );
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 400);
            }

            if (!collect($selectedBundleItems)->contains(fn($item) => ($item['item_type'] ?? null) === 'product' && ($item['product_type'] ?? null) === 'physical')) {
                return response()->json(['message' => 'Bundle hii haina bidhaa za kusafirishwa.'], 400);
            }
        }

        // Physical address is only required for shipping inquiries.
        if (!$isServiceInquiry && !$isSelfPickup && empty($validated['physical_address'])) {
            return response()->json(['message' => 'Anwani ya uwasilishaji inahitajika.'], 422);
        }

        // Resolve buyer
        $buyer = $request->user();
        if (!$buyer) {
            $buyer = \App\Models\User::firstOrCreate(
                ['phone_number' => $validated['account_phone']],
                ['name' => $validated['buyer_name'] ?? 'Guest Buyer', 'role' => 'buyer']
            );
        }

        $isMenuBundle = $bundle && !empty($validated['selected_bundle_items'] ?? []);
        $unitPrice = $bundle
            ? ($isMenuBundle ? (float) collect($selectedBundleItems)->sum('line_total') : (float) ($bundle->price ?? 0))
            : $this->resolveBasePrice($product, $selectedVariant, $servicePricingInputs);
        $groupSaleCampaign = null;
        if ($product && !empty($validated['group_sale_campaign_id'])) {
            $groupSaleCampaign = $this->resolveGroupSaleCampaign((int) $validated['group_sale_campaign_id'], $product);
            $unitPrice = (float) $groupSaleCampaign->campaign_price;
        }
        $totalPrice = $product
            ? round($unitPrice * $requestedQuantity, 2)
            : $unitPrice;
        $transactionRef = 'INQ-' . Str::upper(Str::random(10));

        $order = DB::transaction(function () use ($buyer, $product, $bundle, $selectedVariant, $selectedBundleItems, $unitPrice, $totalPrice, $requestedQuantity, $validated, $transactionRef, $isSelfPickup, $deliveryType, $groupSaleCampaign, $isServiceInquiry) {
            $merchantId = $product?->merchant_id ?? $bundle?->merchant_id;
            $newOrder = Order::create([
                'buyer_id' => $buyer->id,
                'merchant_id' => $merchantId,
                'product_id' => $product?->id,
                'variant_id' => $selectedVariant?->id,
                'variant_snapshot' => $selectedVariant ? [
                    'id' => $selectedVariant->id,
                    'name' => $selectedVariant->name,
                    'sku' => $selectedVariant->sku,
                    'attributes' => $selectedVariant->attributes ?? [],
                    'swatch_image_url' => $selectedVariant->swatch_image_url,
                ] : null,
                'bundle_item_selection' => !empty($selectedBundleItems) ? array_values($selectedBundleItems) : null,
                'purchasable_type' => $product ? 'product' : 'bundle',
                'purchasable_id' => $product?->id ?? $bundle?->id,
                'order_kind' => 'one_time',
                'quantity' => $product ? (int) ceil($requestedQuantity) : 1,
                'requested_quantity' => $product ? $requestedQuantity : 1,
                'product_unit_type_id' => $product?->product_unit_type_id,
                'unit_snapshot' => $product?->product_unit_type_id ? [
                    'unit_type_id' => $product->product_unit_type_id,
                    'name' => $product->unitType?->name,
                    'code' => $product->unitType?->code,
                    'symbol' => $product->unitType?->symbol,
                    'sellable_quantity' => (float) ($product->sellable_quantity ?: 1),
                    'quantity_represents_packages' => true,
                    'package_content_quantity' => $product->package_content_quantity !== null ? (float) $product->package_content_quantity : null,
                    'package_content_unit_type' => $product->package_content_unit_type_id ? [
                        'unit_type_id' => $product->package_content_unit_type_id,
                        'name' => $product->packageContentUnitType?->name,
                        'code' => $product->packageContentUnitType?->code,
                        'symbol' => $product->packageContentUnitType?->symbol,
                    ] : null,
                    'package_contents' => $product->package_contents,
                    'package_content_items' => $product->package_content_items ?: [],
                ] : null,
                'unit_price' => $unitPrice,
                'total_paid' => $totalPrice, // No shipping fee for pickup
                'shipping_fee' => ($isSelfPickup || $isServiceInquiry) ? 0 : null,
                'payment_status' => 'pending',
                'is_inquiry' => true,
                'inquiry_status' => $isSelfPickup ? 'quoted' : 'pending', // Pickup is auto-quoted (no shipping cost needed)
                'group_sale_campaign_id' => $groupSaleCampaign?->id,
                'idempotency_key' => $validated['idempotency_key'],
                'transaction_ref' => $transactionRef,
                'account_phone' => $validated['account_phone'],
                'payment_phone' => $validated['account_phone'],
                'expires_at' => now()->addMinutes(30),
            ]);

            if (!$isServiceInquiry) {
                \App\Models\Delivery::create([
                    'order_id' => $newOrder->id,
                    'shipping_zone_id' => $isSelfPickup ? null : ($validated['delivery_zone_id'] ?? null),
                    'delivery_type' => $deliveryType,
                    'physical_address' => $isSelfPickup ? null : ($validated['physical_address'] ?? null),
                    'shipping_hotspot_id' => $validated['shipping_hotspot_id'] ?? null,
                    'latitude' => $validated['buyer_lat'] ?? null,
                    'longitude' => $validated['buyer_lng'] ?? null,
                    'delivery_status' => $isSelfPickup ? 'awaiting_pickup' : 'inquiry',
                    'pickup_pin' => $isSelfPickup ? str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT) : null,
                ]);
            }

            $this->initializeOrderChat($newOrder);

            return $newOrder;
        });

        return response()->json([
            'message' => $isSelfPickup
                ? 'Umechagua kuchukua dukani! Kamilisha malipo kwenye order chat, kisha Takeer itakutumia Pickup PIN.'
                : ($isServiceInquiry ? 'Service enquiry created. Chat with the merchant to agree the final offer.' : 'Inquiry created successfully.'),
            'order' => OrderResource::make($order->loadMissing(['delivery']))->resolve(),
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

        $paymentPhone = $request->input('payment_number') ?? $order->payment_phone;

        // Verify inventory again before payment
        try {
            DB::transaction(function () use ($order, $paymentPhone) {
                $this->reservePhysicalOrderInventory($order);
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
            $isPhysical = $order->requiresPhysicalFulfillment();
            $isService = $order->product?->isService();
            $serviceRequest = \App\Models\ServiceRequest::query()
                ->where('payment_order_id', $order->id)
                ->first();
            $targetStatus = $isPhysical ? 'awaiting_merchant_confirmation' : (($serviceRequest || $isService) ? 'escrow_locked' : 'resolved_merchant_paid');

            $order->markPhysicalAgreement([
                'total_paid' => (float) $order->total_paid,
                'notes' => $isService
                    ? 'Buyer accepted the quoted service offer and initiated payment.'
                    : 'Buyer accepted the quoted physical order and initiated payment.',
            ]);
            $order->update([
                'payment_status' => $targetStatus,
                'merchant_confirmed_at' => $isPhysical ? now() : $order->merchant_confirmed_at,
            ]);

            if (!$isPhysical) {
                app(\App\Services\EntitlementService::class)->grantForOrder($order->fresh(['product']));
            }
            if ($serviceRequest) {
                $serviceRequest->update([
                    'payment_status' => 'held',
                    'delivery_status' => 'scheduled',
                    'status' => 'confirmed',
                ]);
            }

            // Log TRA-ready transaction simulation
            $fee = app(\App\Services\FeePolicyService::class)->calculateForOrder($order, (float) $order->total_paid);
            \App\Models\Transaction::create([
                'user_id' => $order->buyer_id,
                'merchant_id' => $order->merchant_id,
                'order_id' => $order->id,
                'type' => 'order_revenue',
                ...$fee['snapshot'],
                'gross_amount' => $order->total_paid,
                'fee_amount' => $fee['fee_amount'],
                'net_amount' => $fee['net_amount'],
                'tax_amount' => $fee['tax_amount'],
                'reference' => 'SIM-' . strtoupper(Str::random(10)),
            ]);

            // Freeze funds in merchant's wallet simulation
            $wallet = $order->merchant->wallet()->firstOrCreate(
                ['merchant_id' => $order->merchant_id],
                ['user_id' => $order->merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
            );
            $wallet->increment('frozen_balance', $order->total_paid);

            $order->loadMissing(['buyer', 'merchant.user']);
            $publicId = (string) ($order->public_id ?: $order->id);
            if ($order->buyer?->phone_number) {
                $this->smsService->sendPhysicalPaymentHeldToBuyer($order->buyer->phone_number, $publicId, (float) $order->total_paid, $order->buyer_id);
                if ($order->delivery?->delivery_type === 'self_pickup' && $order->delivery?->pickup_pin) {
                    $this->smsService->sendPickupPinToBuyer($order->buyer->phone_number, $publicId, (string) $order->delivery->pickup_pin, $order->buyer_id);
                }
            }
            if ($order->merchant?->user?->phone_number) {
                $this->smsService->sendPhysicalPaymentHeldToMerchant($order->merchant->user->phone_number, $publicId, (float) $order->total_paid, $order->merchant->user_id);
            }

            return response()->json([
                'message' => 'Malipo ya majaribio yamefanikiwa! Agizo limehifadhiwa (Escrow).',
                'order' => OrderResource::make($order->fresh(['product', 'delivery']))->resolve(),
            ]);

        } catch (RuntimeException $e) {
            Log::error('CheckoutController@payInquiry: Gateway error.', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);

            $order->releaseInventory();

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

        $body = "Habari, order mpya imewekwa kwa ajili ya: " . ($order->product->title ?? $order->resolved_purchasable?->title ?? 'Bidhaa yako') . ".\n";

        // Check delivery type for personalized messages
        $delivery = $order->delivery ?? $order->load('delivery')->delivery;
        $deliveryType = $delivery?->delivery_type ?? null;

        if ($deliveryType === 'self_pickup') {
            $body .= "Mteja amechagua KUCHUKUA DUKANI. Baada ya malipo kukamilika, Takeer itamtumia mteja Pickup PIN. Mteja au dereva wake akifika, ingiza PIN hiyo kwenye order chat au order details ili kuthibitisha pickup na kukamilisha oda.";
        } elseif ($order->product?->isService() && $order->is_inquiry) {
            $body .= "Hii ni enquiry ya huduma. Tafadhali ongea na mteja hapa, mkubaliane mahitaji na bei ya huduma, kisha tuma offer ya mwisho.";
        } elseif ($order->is_inquiry) {
            $body .= "Haya ni mapendekezo ya usafirishaji. Tafadhali thibitisha gharama ya usafiri kwa mteja.";
        } else {
            $body .= "Malipo yamefanikiwa na yamehifadhiwa (Escrow). Tafadhali anza mchakato wa kusafirisha. Mteja akapopokea bidhaa pesa itatumwa moja kwa moja kwako kama umechagua automatic payout au utahitajika kuomba kuitoa wakati wowote.";
        }

        \App\Models\Message::create([
            'order_id' => $order->id,
            'sender_id' => $buyerUser->id,
            'receiver_id' => $merchantUser->id,
            'type' => 'system',
            'body' => $body,
        ]);
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
                    throw new RuntimeException("{$selectedProduct->title} imeisha au haitoshi kwa bundle hii.");
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
            $variantUpdated = ProductVariant::query()
                ->whereKey($order->variant->id)
                ->where('product_id', $product->id)
                ->where('inventory_count', '>=', $quantity)
                ->decrement('inventory_count', $quantity);

            ProductVariant::query()
                ->whereKey($order->variant->id)
                ->where('inventory_quantity', '>=', $requestedQuantity)
                ->decrement('inventory_quantity', $requestedQuantity);

            if ($variantUpdated === 0) {
                throw new RuntimeException('Variant uliyochagua imeisha au haitoshi.');
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
            throw new RuntimeException('Bidhaa hii imeisha.');
        }

        $this->decrementLocationInventory($product->id, $order->variant_id, $requestedQuantity, $product->merchant_id);
        $order->forceFill(['inventory_reserved_at' => now()])->saveQuietly();
    }

    private function decrementLocationInventory(int $productId, ?int $variantId, float $quantity, int $merchantId): void
    {
        $integerQuantity = (int) ceil($quantity);
        // Try to find a location that has enough stock for this specific product/variant
        $inventory = \App\Models\ProductLocationInventory::query()
            ->when($variantId, fn($query) => $query->whereNull('product_id'), fn($query) => $query->where('product_id', $productId))
            ->where('product_variant_id', $variantId)
            ->where('quantity', '>=', $integerQuantity)
            ->orderByDesc('quantity') // Use location with most stock first
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
        } else {
            // Fallback: try primary location
            $primaryLoc = \App\Models\MerchantLocation::where('merchant_id', $merchantId)
                ->where('is_primary', true)
                ->first() ?? \App\Models\MerchantLocation::where('merchant_id', $merchantId)->first();

            if ($primaryLoc) {
                \App\Models\ProductLocationInventory::updateOrCreate(
                    [
                        'merchant_location_id' => $primaryLoc->id,
                        'product_id' => $variantId ? null : $productId,
                        'product_variant_id' => $variantId,
                    ],
                    [
                        'quantity' => DB::raw("GREATEST(0, quantity - {$integerQuantity})"),
                        'quantity_decimal' => DB::raw("GREATEST(0, COALESCE(quantity_decimal, quantity) - {$quantity})"),
                    ]
                );
            }
        }
    }
}
