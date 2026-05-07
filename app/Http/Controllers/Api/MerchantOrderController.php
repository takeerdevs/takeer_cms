<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MerchantOrderController extends Controller
{
    public function __construct(private readonly SmsService $smsService)
    {
    }

    /**
     * Return paginated orders for a specific merchant (owned by the authenticated user).
     */
    public function index(Request $request, Merchant $merchant): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $query = Order::with(['buyer', 'product.unitType', 'variant'])
            ->where('merchant_id', $merchant->id)
            ->latest();

        // Optional status filter
        if ($request->filled('status')) {
            $status = (string) $request->input('status');
            $query->where('payment_status', $status);

            // Escrow workflow is meaningful for physical products and physical bundles.
            if (in_array($status, ['awaiting_merchant_confirmation', 'escrow_locked', 'disputed'], true)) {
                $this->scopePhysicalFulfillmentOrders($query);
            }
        }

        // Optional purchasable_type filter (product/content_item/bundle/subscription_plan)
        if ($request->filled('kind')) {
            $query->where('purchasable_type', $request->input('kind'));
        }

        $orders = $query->paginate($perPage);
        $orders->getCollection()->transform(function (Order $order) {
            $display = $this->resolveDisplay($order);

            return [
                'id' => $order->id,
                'public_id' => $order->public_id,
                'transaction_ref' => $order->transaction_ref,
                'payment_status' => $order->payment_status,
                'quantity' => $order->quantity,
                'requested_quantity' => $order->requested_quantity !== null ? (float) $order->requested_quantity : (float) $order->quantity,
                'unit_snapshot' => $order->unit_snapshot,
                'total_paid' => $order->total_paid,
                'created_at' => $order->created_at?->toISOString(),
                'purchasable_type' => $order->purchasable_type,
                'purchasable_id' => $order->purchasable_id,
                'buyer' => $order->buyer ? [
                    'id' => $order->buyer->id,
                    'name' => $order->buyer->name,
                    'phone_number' => $order->buyer->phone_number,
                ] : null,
                'product' => $order->product ? [
                    'id' => $order->product->id,
                    'title' => $order->product->title,
                    'type' => $order->product->type,
                    'image_url' => $order->product->image_url,
                ] : null,
                'variant' => $order->variant_snapshot ?: ($order->variant ? [
                    'id' => $order->variant->id,
                    'name' => $order->variant->name,
                    'sku' => $order->variant->sku,
                    'attributes' => $order->variant->attributes ?? [],
                    'swatch_image_url' => $order->variant->swatch_image_url,
                ] : null),
                'display_title' => $display['title'],
                'display_kind' => $display['kind'],
                'display_icon' => $display['icon'],
                'is_escrow_order' => $display['is_escrow_order'],
                'is_inquiry' => (bool) $order->is_inquiry,
                'inquiry_status' => $order->inquiry_status,
                'shipping_fee' => $order->shipping_fee !== null ? (float) $order->shipping_fee : null,
            ];
        });

        return response()->json([
            'data' => $orders->items(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
            ],
            'links' => [
                'next' => $orders->nextPageUrl(),
                'prev' => $orders->previousPageUrl(),
            ],
        ]);
    }

    /**
     * Return summary counts scoped to this merchant.
     */
    public function summary(Request $request, Merchant $merchant): JsonResponse
    {
        $base = Order::where('merchant_id', $merchant->id);

        return response()->json([
            'total' => (clone $base)->count(),
            'pending' => $this->scopePhysicalFulfillmentOrders(
                (clone $base)->where('payment_status', 'awaiting_merchant_confirmation')
            )->count(),
            'escrow' => $this->scopePhysicalFulfillmentOrders(
                (clone $base)->where('payment_status', 'escrow_locked')
            )->count(),
            'completed' => (clone $base)->whereIn('payment_status', ['resolved_merchant_paid'])->count(),
            'disputed' => $this->scopePhysicalFulfillmentOrders(
                (clone $base)->where('payment_status', 'disputed')
            )->count(),
            'today' => (clone $base)->whereDate('created_at', today())->count(),
        ]);
    }

    /**
     * Return section-level commerce metrics for merchant managers.
     */
    public function commerceSummary(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);

        $today = today();
        $orderBase = Order::where('merchant_id', $merchant->id);
        $todayOrders = (clone $orderBase)->whereDate('created_at', $today);

        $sectionTotals = fn($query) => [
            'today_orders' => (clone $query)->count(),
            'today_sales' => (float) ((clone $query)->sum('total_paid') ?: 0),
        ];

        $physicalOrdersToday = (clone $todayOrders)
            ->where('purchasable_type', 'product')
            ->whereHas('product', fn($q) => $q->where('type', 'physical'));

        $digitalOrdersToday = (clone $todayOrders)
            ->where('purchasable_type', 'product')
            ->whereHas('product', fn($q) => $q->where('type', 'digital'));

        $serviceOrdersToday = (clone $todayOrders)
            ->where('purchasable_type', 'product')
            ->whereHas('product', fn($q) => $q->where('type', 'service'));

        $postOrdersToday = (clone $todayOrders)
            ->whereIn('purchasable_type', ['post', 'content_item']);

        $bundleOrdersToday = (clone $todayOrders)
            ->where('purchasable_type', 'bundle');

        $subscriptionOrdersToday = (clone $todayOrders)
            ->where('purchasable_type', 'subscription_plan');

        $productsBase = Product::where('merchant_id', $merchant->id);
        $postsBase = Post::where('merchant_id', $merchant->id);
        $contentItemsBase = ContentItem::where('merchant_id', $merchant->id);
        $bundlesBase = Bundle::where('merchant_id', $merchant->id);
        $plansBase = SubscriptionPlan::where('merchant_id', $merchant->id);

        return response()->json([
            'date' => $today->toDateString(),
            'sections' => [
                'products' => [
                    'total_items' => (clone $productsBase)->where('type', 'physical')->count(),
                    'in_stock_items' => (clone $productsBase)->where('type', 'physical')->where('inventory_count', '>', 0)->count(),
                    ...$sectionTotals($physicalOrdersToday),
                ],
                'downloads' => [
                    'total_items' => (clone $productsBase)->where('type', 'digital')->count(),
                    'uploaded_files' => (clone $productsBase)->where('type', 'digital')->where(function ($q) {
                        $q->where('download_link', 'like', 'private://%')
                            ->orWhere('download_link', 'like', 'digital-products/%');
                    })->count(),
                    'external_links' => (clone $productsBase)->where('type', 'digital')->where('download_link', 'like', 'http%')->count(),
                    ...$sectionTotals($digitalOrdersToday),
                ],
                'services' => [
                    'total_items' => (clone $productsBase)->where('type', 'service')->count(),
                    'configured_items' => (clone $productsBase)->where('type', 'service')->whereNotNull('url')->where('url', '!=', '')->count(),
                    ...$sectionTotals($serviceOrdersToday),
                ],
                'posts' => [
                    'total_items' => (clone $postsBase)->count(),
                    'long_form' => (clone $contentItemsBase)->count(),
                    'short_form' => (clone $postsBase)->whereNull('content_item_id')->count(),
                    'total_views' => (int) ((clone $postsBase)->sum('views_count') ?: 0),
                    'total_likes' => (int) ((clone $postsBase)->sum('likes_count') ?: 0),
                    ...$sectionTotals($postOrdersToday),
                ],
                'bundles' => [
                    'total_items' => (clone $bundlesBase)->count(),
                    'published_items' => (clone $bundlesBase)->where('status', 'published')->count(),
                    ...$sectionTotals($bundleOrdersToday),
                ],
                'subscriptions' => [
                    'total_items' => (clone $plansBase)->count(),
                    'active_tiers' => (clone $plansBase)->where('status', 'active')->count(),
                    'active_members' => UserSubscription::where('merchant_id', $merchant->id)->where('status', 'active')->count(),
                    ...$sectionTotals($subscriptionOrdersToday),
                ],
            ],
        ]);
    }

    /**
     * Return full detail for one merchant order.
     */
    public function show(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);

        $order->load(['buyer', 'product.unitType', 'variant', 'delivery.shippingZone', 'dispute', 'review']);
        $display = $this->resolveDisplay($order);

        return response()->json([
            'id' => $order->id,
            'public_id' => $order->public_id,
            'transaction_ref' => $order->transaction_ref,
            'payment_status' => $order->payment_status,
            'quantity' => $order->quantity,
            'requested_quantity' => $order->requested_quantity !== null ? (float) $order->requested_quantity : (float) $order->quantity,
            'unit_snapshot' => $order->unit_snapshot,
            'unit_price' => $order->unit_price,
            'total_paid' => $order->total_paid,
            'created_at' => $order->created_at?->toISOString(),
            'purchasable_type' => $order->purchasable_type,
            'purchasable_id' => $order->purchasable_id,
            'payment_phone' => $order->payment_phone,
            'account_phone' => $order->account_phone,
            'merchant_dispatch_video_url' => $order->merchant_dispatch_video_url,
            'is_inquiry' => (bool) $order->is_inquiry,
            'inquiry_status' => $order->inquiry_status,
            'agreement_snapshot' => $order->agreement_snapshot,
            'agreed_at' => $order->agreed_at?->toISOString(),
            'merchant_confirmed_at' => $order->merchant_confirmed_at?->toISOString(),
            'paid_out_at' => $order->paid_out_at?->toISOString(),
            'shipping_fee' => $order->shipping_fee !== null ? (float) $order->shipping_fee : null,
            'custom_delivery' => [
                'file_url' => $order->custom_delivery_file_url,
                'file_name' => $order->custom_delivery_file_name,
                'file_mime' => $order->custom_delivery_file_mime,
                'file_size' => $order->custom_delivery_file_size !== null ? (int) $order->custom_delivery_file_size : null,
                'message' => $order->custom_delivery_message,
                'delivered_at' => $order->custom_delivery_delivered_at?->toISOString(),
                'status' => $order->custom_delivery_status,
                'revision_message' => $order->custom_delivery_revision_message,
                'revision_requested_at' => $order->custom_delivery_revision_requested_at?->toISOString(),
                'accepted_at' => $order->custom_delivery_accepted_at?->toISOString(),
            ],
            'bundle_item_selection' => $order->bundle_item_selection ?? [],
            'buyer' => $order->buyer ? [
                'id' => $order->buyer->id,
                'name' => $order->buyer->name,
                'phone_number' => $order->buyer->phone_number,
            ] : null,
            'product' => $order->product ? [
                'id' => $order->product->id,
                'title' => $order->product->title,
                'type' => $order->product->type,
                'image_url' => $order->product->image_url,
                'digital_delivery_type' => $order->product->digital_delivery_type,
                'digital_content_type' => $order->product->digital_content_type,
            ] : null,
            'variant' => $order->variant_snapshot ?: ($order->variant ? [
                'id' => $order->variant->id,
                'name' => $order->variant->name,
                'sku' => $order->variant->sku,
                'attributes' => $order->variant->attributes ?? [],
                'swatch_image_url' => $order->variant->swatch_image_url,
            ] : null),
            'delivery' => $order->delivery ? [
                'id' => $order->delivery->id,
                'delivery_status' => $order->delivery->delivery_status,
                'status' => $order->delivery->delivery_status,
                'delivery_type' => $order->delivery->delivery_type ?? $order->delivery->shippingZone?->delivery_type,
                'type' => $order->delivery->delivery_type ?? $order->delivery->shippingZone?->delivery_type,
                'shipping_zone_id' => $order->delivery->shipping_zone_id,
                'shipping_hotspot_id' => $order->delivery->shipping_hotspot_id,
                'confirmed_at' => $order->delivery->confirmed_at?->toISOString(),
                'delivered_at' => $order->delivery->delivered_at?->toISOString(),
                'boda_phone' => $order->delivery->boda_phone,
                'bus_company' => $order->delivery->bus_company,
                'waybill_tracking_number' => $order->delivery->waybill_tracking_number,
                'waybill_photo_url' => $order->delivery->waybill_photo_url,
                'physical_address' => $order->delivery->physical_address,
                'latitude' => $order->delivery->latitude,
                'longitude' => $order->delivery->longitude,
                'buyer_release_pin' => $order->delivery->buyer_release_pin,
                'pickup_pin' => $order->delivery->pickup_pin ? '****' : null, // keep it hidden for now, or maybe merchant needs it? No, merchant enters it.
                'pickup_location' => $order->delivery->pickup_location,
                'dropoff_location' => $order->delivery->dropoff_location,
                'buyer_unboxing_video_url' => $order->delivery->buyer_unboxing_video_url,
            ] : null,
            'review' => $order->review ? [
                'id' => $order->review->id,
                'rating' => $order->review->rating,
                'comment' => $order->review->comment,
                'created_at' => $order->review->created_at?->toISOString(),
            ] : null,
            'dispute' => $order->dispute ? [
                'id' => $order->dispute->id,
                'status' => $order->dispute->status,
                'reason' => $order->dispute->reason,
            ] : null,
            'display_title' => $display['title'],
            'display_kind' => $display['kind'],
            'display_icon' => $display['icon'],
            'is_escrow_order' => $display['is_escrow_order'],
            'order_flow' => $display['is_escrow_order'] ? 'escrow' : 'instant',
        ]);
    }

    public function uploadCustomDelivery(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        $order->loadMissing('product');
        abort_unless(
            $order->product?->type === 'digital'
                && ($order->product?->digital_delivery_type ?? null) === 'custom_delivery',
            422,
            'This order is not a custom digital delivery.'
        );

        $validated = $request->validate([
            'file' => 'required|file|max:2097152',
            'message' => 'nullable|string|max:3000',
        ]);

        $file = $validated['file'];
        $originalName = $file->getClientOriginalName() ?: 'custom-delivery';
        $extension = $file->getClientOriginalExtension();
        $path = $file->storeAs(
            'custom-deliveries/'.$order->id,
            Str::uuid()->toString().($extension ? '.'.$extension : ''),
            'local'
        );

        $order->update([
            'custom_delivery_file_url' => 'private://'.$path,
            'custom_delivery_file_name' => $originalName,
            'custom_delivery_file_mime' => $file->getClientMimeType(),
            'custom_delivery_file_size' => $file->getSize(),
            'custom_delivery_message' => $validated['message'] ?? null,
            'custom_delivery_delivered_at' => now(),
            'custom_delivery_status' => 'delivered',
            'custom_delivery_revision_message' => null,
            'custom_delivery_revision_requested_at' => null,
            'custom_delivery_accepted_at' => null,
        ]);

        return response()->json([
            'message' => 'Custom digital delivery uploaded.',
            'order' => $order->fresh(['buyer', 'product']),
        ]);
    }

    private function resolveDisplay(Order $order): array
    {
        // Product orders can be physical, digital file, or service/booking.
        if ($order->purchasable_type === 'product' && $order->product) {
            $productType = $order->product->type;
            $kind = match ($productType) {
                'physical' => 'physical_product',
                'service' => 'service_booking',
                'digital' => ($order->product->digital_delivery_type ?? null) === 'custom_delivery' ? 'custom_work' : 'digital_file',
                default => 'digital_file',
            };

            return [
                'title' => $order->product->title ?: 'Untitled product',
                'kind' => $kind,
                'icon' => match ($kind) {
                    'physical_product' => 'shopping_bag',
                    'service_booking' => 'calendar_clock',
                    'custom_work' => 'file_up',
                    default => 'download',
                },
                'is_escrow_order' => $order->requiresPhysicalFulfillment()
                    || (($order->product->digital_delivery_type ?? null) === 'custom_delivery'),
            ];
        }

        if ($order->purchasable_type === 'post') {
            $post = Post::find($order->purchasable_id);
            return [
                'title' => $post?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'book_open',
                'is_escrow_order' => false,
            ];
        }

        if ($order->purchasable_type === 'content_item') {
            $content = ContentItem::find($order->purchasable_id);
            return [
                'title' => $content?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'book_open',
                'is_escrow_order' => false,
            ];
        }

        if ($order->purchasable_type === 'bundle') {
            $bundle = Bundle::find($order->purchasable_id);
            $isPhysicalBundle = $order->requiresPhysicalFulfillment();

            return [
                'title' => $bundle?->title ?: 'Bundle order',
                'kind' => $isPhysicalBundle ? 'physical_bundle' : ($bundle?->is_course ? 'course_bundle' : 'bundle'),
                'icon' => 'boxes',
                'is_escrow_order' => $isPhysicalBundle,
            ];
        }

        if ($order->purchasable_type === 'subscription_plan') {
            $plan = SubscriptionPlan::find($order->purchasable_id);
            return [
                'title' => $plan?->name ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'crown',
                'is_escrow_order' => false,
            ];
        }

        return [
            'title' => $order->product?->title ?: 'Order item',
            'kind' => 'post_content',
            'icon' => 'book_open',
            'is_escrow_order' => false,
        ];
    }

    private function scopePhysicalFulfillmentOrders($query)
    {
        return $query->where(function ($query) {
            $query->where(function ($productQuery) {
                $productQuery->where('purchasable_type', 'product')
                    ->whereHas('product', fn($product) => $product->where('type', 'physical'));
            })->orWhere('purchasable_type', 'bundle');
        });
    }

    /**
     * Dispatch an intercity or local boda delivery.
     */
    public function dispatchOrder(Request $request, Merchant $merchant, Order $order, string $mode = 'local'): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        abort_unless($order->requiresPhysicalFulfillment(), 422, 'Dispatch evidence inahitajika kwa physical orders pekee.');
        abort_unless(in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked'], true), 422, 'Order must be paid before dispatch.');
        abort_unless(in_array($mode, ['local', 'intercity'], true), 422, 'Delivery mode is invalid.');
        abort_if($order->delivery?->delivery_type === 'self_pickup', 422, 'Self-pickup orders are completed with the pickup PIN, not dispatch.');
        
        $validated = $request->validate([
            'boda_phone' => 'nullable|string',
            'bus_company' => 'nullable|string',
            'waybill_tracking_number' => 'nullable|string',
            'waybill_photo_url' => $mode === 'intercity' ? 'required|string' : 'nullable|string',
            'merchant_dispatch_video_url' => 'required|string',
        ]);

        $order->update([
            'payment_status' => 'escrow_locked',
            'merchant_dispatch_video_url' => $validated['merchant_dispatch_video_url'] ?? null,
            'merchant_confirmed_at' => $order->merchant_confirmed_at ?: now(),
        ]);

        $delivery = $order->delivery()->firstOrNew(['order_id' => $order->id]);
        $deliveryType = $delivery->delivery_type;
        if (!$deliveryType || $deliveryType === 'shipping') {
            $deliveryType = $mode === 'intercity' ? 'intercity_bus' : 'local_boda';
        }

        $delivery->fill([
            'delivery_status' => 'in_transit',
            'delivery_type' => $deliveryType,
            'boda_phone' => $validated['boda_phone'] ?? $delivery->boda_phone,
            'bus_company' => $validated['bus_company'] ?? $delivery->bus_company,
            'waybill_tracking_number' => $validated['waybill_tracking_number'] ?? $delivery->waybill_tracking_number,
            'waybill_photo_url' => $validated['waybill_photo_url'] ?? $delivery->waybill_photo_url,
            'buyer_release_pin' => $delivery->buyer_release_pin ?: str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT),
        ])->save();

        $order->loadMissing(['buyer']);
        if ($order->buyer?->phone_number) {
            $publicId = (string) ($order->public_id ?: $order->id);
            if ($deliveryType === 'intercity_bus') {
                $this->smsService->sendIntercityDispatchNotification(
                    $order->buyer->phone_number,
                    $publicId,
                    $delivery->bus_company ?: 'Intercity Bus',
                    $delivery->waybill_tracking_number ?: 'N/A',
                    (string) $delivery->buyer_release_pin,
                    $order->buyer_id
                );
            } else {
                $this->smsService->sendLocalDispatchNotification(
                    $order->buyer->phone_number,
                    $publicId,
                    (string) $delivery->buyer_release_pin,
                    $delivery->boda_phone,
                    $order->buyer_id
                );
            }
        }

        return response()->json(['message' => 'Mzigo umesafirishwa kikamilifu.', 'order' => $order->fresh(['delivery', 'product', 'merchant.locations'])]);
    }

    /**
     * Verify pickup using Customer's PIN.
     * On success: escrow released to merchant wallet, order marked complete.
     */
    public function verifyPickup(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);

        $validated = $request->validate(['pickup_pin' => 'required|string']);

        if (!$order->delivery || $order->delivery->pickup_pin !== $validated['pickup_pin']) {
            return response()->json(['message' => 'PIN sio sahihi. Tafadhali hakiki upya.'], 400);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($order, $merchant) {
            $order->delivery->update(['delivery_status' => 'delivered']);

            app(\App\Services\WalletService::class)->releaseEscrowToMerchant($order);
            app(\App\Services\EntitlementService::class)->grantForOrder($order->fresh(['product']));
        });

        return response()->json(['message' => 'Mzigo umekabidhiwa kikamilifu! Malipo yameidhinishwa.', 'order' => $order->fresh(['delivery'])]);
    }
    
    /**
     * Verify local delivery using Customer's PIN.
     */
    public function verifyDelivery(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);

        $validated = $request->validate(['buyer_release_pin' => 'required|string']);

        if (!$order->delivery || $order->delivery->buyer_release_pin !== $validated['buyer_release_pin']) {
            return response()->json(['message' => 'PIN sio sahihi. Mteja hajaidhinisha mzigo.'], 400);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($order, $merchant) {
            $order->delivery->update(['delivery_status' => 'delivered']);

            app(\App\Services\WalletService::class)->releaseEscrowToMerchant($order);
            app(\App\Services\EntitlementService::class)->grantForOrder($order->fresh(['product']));
        });

        return response()->json(['message' => 'Mzigo umefika! Malipo yameidhinishwa.', 'order' => $order]);
    }

    /**
     * POST /api/merchant/orders/{order}/quote
     * 
     * Allows a merchant to provide a shipping quote and adjust product prices (discounts) for an order.
     */
    public function provideQuote(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if ($order->merchant_id !== ($user->merchant?->id ?? $user->merchantProfiles()->first()?->id)) {
            abort(403, 'Unauthorized.');
        }

        $validated = $request->validate([
            'unit_price' => 'nullable|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
            'message' => 'nullable|string|max:500',
        ]);

        $isServiceOrder = $order->product?->isService();
        if ($isServiceOrder && !isset($validated['unit_price']) && isset($validated['shipping_fee'])) {
            $validated['unit_price'] = $validated['shipping_fee'];
        }
        if (!$isServiceOrder && !isset($validated['shipping_fee'])) {
            return response()->json(['message' => 'Shipping fee is required for this order.'], 422);
        }

        $unitPrice = isset($validated['unit_price']) ? (float) $validated['unit_price'] : (float) $order->unit_price;
        $shippingFee = $isServiceOrder ? 0.0 : (float) ($validated['shipping_fee'] ?? 0);
        $requestedQuantity = max(0.001, (float) ($order->requested_quantity ?: $order->quantity ?: 1));
        $sellableQuantity = max(0.001, (float) data_get($order->unit_snapshot, 'sellable_quantity', 1));
        $itemsTotal = $isServiceOrder ? $unitPrice : ($unitPrice * ($requestedQuantity / $sellableQuantity));
        $totalPaid = $itemsTotal + $shippingFee;
        
        $order->update([
            'unit_price' => $unitPrice,
            'shipping_fee' => $shippingFee,
            'total_paid' => $totalPaid,
            'is_inquiry' => true, // Ensure it's treated as inquiry for the quoting flow
            'inquiry_status' => 'quoted',
            'agreement_snapshot' => [
                'unit_price' => $unitPrice,
                'shipping_fee' => $shippingFee,
                'quantity' => (int) max(1, $order->quantity ?: 1),
                'requested_quantity' => $requestedQuantity,
                'unit_snapshot' => $order->unit_snapshot,
                'total_paid' => $totalPaid,
                'delivery_type' => $order->delivery?->delivery_type,
                'physical_address' => $order->delivery?->physical_address,
                'notes' => $validated['message'] ?? null,
                'offered_by' => 'merchant',
                'offered_at' => now()->toISOString(),
            ],
            'agreed_at' => null,
        ]);

        // Inject system message into chat
        $order->messages()->create([
            'sender_id' => $user->id,
            'receiver_id' => $order->buyer_id,
            'body' => $validated['message'] ?: ($isServiceOrder
                ? "Nimetuma offer ya huduma: TZS " . number_format($totalPaid) . ". Tafadhali fanya malipo kukamilisha booking."
                : "Nimesasisha bei. Bei ya bidhaa: TZS " . number_format($unitPrice) . ", Gharama ya usafiri: TZS " . number_format($shippingFee) . ". Tafadhali fanya malipo kukamilisha agizo."),
            'is_system' => false, // Send as a real message from merchant
        ]);

        if ($order->buyer?->phone_number) {
            $this->smsService->sendPhysicalQuoteReady(
                $order->buyer->phone_number,
                (string) ($order->public_id ?: $order->id),
                (float) $order->total_paid,
                $order->buyer_id
            );
        }

        return response()->json([
            'message' => 'Quote sent to the buyer.',
            'order' => $order->fresh(['buyer', 'product', 'variant', 'delivery']),
        ]);
    }

    /**
     * POST /api/merchant/orders/{order}/extend-lock
     */
    public function extendExpiration(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        
        if ($order->payment_status !== 'pending') {
            return response()->json(['message' => 'Huwezi kuongeza muda kwa agizo hili.'], 400);
        }

        $order->update([
            'expires_at' => ($order->expires_at?->isPast() ? now() : $order->expires_at)->addMinutes(30)
        ]);

        return response()->json([
            'message' => 'Muda wa lock umeongezwa kwa dakika 30.',
            'order' => $order
        ]);
    }

    /**
     * POST /api/merchant/orders/{order}/release-inventory
     */
    public function releaseInventory(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        
        if ($order->payment_status !== 'pending') {
            return response()->json(['message' => 'Huwezi kuachia stock ya agizo hili.'], 400);
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($order) {
            $order->releaseInventory();
            $order->update(['payment_status' => 'failed']);
        });

        return response()->json([
            'message' => 'Stock imeachiwa na agizo limesitishwa.',
            'order' => $order
        ]);
    }
}
