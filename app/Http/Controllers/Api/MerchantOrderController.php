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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantOrderController extends Controller
{
    /**
     * Return paginated orders for a specific merchant (owned by the authenticated user).
     */
    public function index(Request $request, Merchant $merchant): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $query = Order::with(['buyer', 'product', 'variant'])
            ->where('merchant_id', $merchant->id)
            ->latest();

        // Optional status filter
        if ($request->filled('status')) {
            $status = (string) $request->input('status');
            $query->where('payment_status', $status);

            // Escrow workflow is only meaningful for physical product orders.
            if (in_array($status, ['awaiting_merchant_confirmation', 'escrow_locked', 'disputed'], true)) {
                $query->where('purchasable_type', 'product')
                    ->whereHas('product', fn($q) => $q->where('type', 'physical'));
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
            'pending' => (clone $base)
                ->where('payment_status', 'awaiting_merchant_confirmation')
                ->where('purchasable_type', 'product')
                ->whereHas('product', fn($q) => $q->where('type', 'physical'))
                ->count(),
            'escrow' => (clone $base)
                ->where('payment_status', 'escrow_locked')
                ->where('purchasable_type', 'product')
                ->whereHas('product', fn($q) => $q->where('type', 'physical'))
                ->count(),
            'completed' => (clone $base)->whereIn('payment_status', ['resolved_merchant_paid'])->count(),
            'disputed' => (clone $base)
                ->where('payment_status', 'disputed')
                ->where('purchasable_type', 'product')
                ->whereHas('product', fn($q) => $q->where('type', 'physical'))
                ->count(),
            'today' => (clone $base)->whereDate('created_at', today())->count(),
        ]);
    }

    /**
     * Return section-level commerce metrics (used by Commerce Studio pages).
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

        $order->load(['buyer', 'product', 'variant', 'delivery.shippingZone', 'dispute']);
        $display = $this->resolveDisplay($order);

        return response()->json([
            'id' => $order->id,
            'public_id' => $order->public_id,
            'transaction_ref' => $order->transaction_ref,
            'payment_status' => $order->payment_status,
            'quantity' => $order->quantity,
            'unit_price' => $order->unit_price,
            'total_paid' => $order->total_paid,
            'created_at' => $order->created_at?->toISOString(),
            'purchasable_type' => $order->purchasable_type,
            'purchasable_id' => $order->purchasable_id,
            'payment_phone' => $order->payment_phone,
            'account_phone' => $order->account_phone,
            'merchant_dispatch_video_url' => $order->merchant_dispatch_video_url,
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
            'delivery' => $order->delivery ? [
                'id' => $order->delivery->id,
                'delivery_status' => $order->delivery->delivery_status,
                'delivery_type' => $order->delivery->shippingZone?->delivery_type,
                'confirmed_at' => $order->delivery->confirmed_at?->toISOString(),
                'delivered_at' => $order->delivery->delivered_at?->toISOString(),
                'boda_phone' => $order->delivery->boda_phone,
                'bus_company' => $order->delivery->bus_company,
                'waybill_tracking_number' => $order->delivery->waybill_tracking_number,
                'waybill_photo_url' => $order->delivery->waybill_photo_url,
                'physical_address' => $order->delivery->physical_address,
                'buyer_release_pin' => $order->delivery->buyer_release_pin,
                'pickup_pin' => $order->delivery->pickup_pin ? '****' : null, // keep it hidden for now, or maybe merchant needs it? No, merchant enters it.
                'pickup_location' => $order->delivery->pickup_location,
                'dropoff_location' => $order->delivery->dropoff_location,
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

    private function resolveDisplay(Order $order): array
    {
        // Product orders can be physical, digital file, or service/booking.
        if ($order->purchasable_type === 'product' && $order->product) {
            $productType = $order->product->type;
            $kind = match ($productType) {
                'physical' => 'physical_product',
                'service' => 'service_booking',
                default => 'digital_file',
            };

            return [
                'title' => $order->product->title ?: 'Untitled product',
                'kind' => $kind,
                'icon' => match ($kind) {
                    'physical_product' => 'shopping_bag',
                    'service_booking' => 'calendar_clock',
                    default => 'download',
                },
                'is_escrow_order' => $productType === 'physical',
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
            return [
                'title' => $bundle?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'boxes',
                'is_escrow_order' => false,
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

    /**
     * Dispatch an intercity or local boda delivery.
     */
    public function dispatchOrder(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        
        $validated = $request->validate([
            'boda_phone' => 'nullable|string',
            'bus_company' => 'nullable|string',
            'waybill_tracking_number' => 'nullable|string',
            'waybill_photo_url' => 'nullable|string',
            'merchant_dispatch_video_url' => 'nullable|string',
        ]);

        $order->update([
            'payment_status' => 'escrow_locked',
            'merchant_dispatch_video_url' => $validated['merchant_dispatch_video_url'] ?? null,
        ]);

        if ($order->delivery) {
            $order->delivery->update([
                'delivery_status' => 'in_transit',
                'boda_phone' => $validated['boda_phone'] ?? null,
                'bus_company' => $validated['bus_company'] ?? null,
                'waybill_tracking_number' => $validated['waybill_tracking_number'] ?? null,
                'waybill_photo_url' => $validated['waybill_photo_url'] ?? null,
            ]);
        }

        return response()->json(['message' => 'Mzigo umesafirishwa kikamilifu.', 'order' => $order]);
    }

    /**
     * Verify pickup using Customer's PIN.
     */
    public function verifyPickup(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);

        $validated = $request->validate(['pickup_pin' => 'required|string']);

        if (!$order->delivery || $order->delivery->pickup_pin !== $validated['pickup_pin']) {
            return response()->json(['message' => 'PIN sio sahihi. Tafadhali hakiki upya.'], 400);
        }

        $order->update(['payment_status' => 'resolved_merchant_paid']);
        $order->delivery->update(['delivery_status' => 'delivered']); // add delivered_at if schema supports it, we'll keep it simple for now

        return response()->json(['message' => 'Mzigo umekabidhiwa kikamilifu! Malipo yameidhinishwa.', 'order' => $order]);
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

        $order->update(['payment_status' => 'resolved_merchant_paid']);
        $order->delivery->update(['delivery_status' => 'delivered']);

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
            'shipping_fee' => 'required|numeric|min:0',
            'message' => 'nullable|string|max:500',
        ]);

        $unitPrice = isset($validated['unit_price']) ? (float) $validated['unit_price'] : (float) $order->unit_price;
        $shippingFee = (float) $validated['shipping_fee'];
        
        $order->update([
            'unit_price' => $unitPrice,
            'shipping_fee' => $shippingFee,
            'total_paid' => ($unitPrice * $order->quantity) + $shippingFee,
            'is_inquiry' => true, // Ensure it's treated as inquiry for the quoting flow
            'inquiry_status' => 'quoted',
        ]);

        // Inject system message into chat
        $order->messages()->create([
            'sender_id' => $user->id,
            'receiver_id' => $order->buyer_id,
            'body' => $validated['message'] ?: "Nimesasisha bei. Bei ya bidhaa: TZS " . number_format($unitPrice) . ", Gharama ya usafiri: TZS " . number_format($shippingFee) . ". Tafadhali fanya malipo kukamilisha agizo.",
            'is_system' => false, // Send as a real message from merchant
        ]);

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
            $order->update(['payment_status' => 'cancelled_manual']);
        });

        return response()->json([
            'message' => 'Stock imeachiwa na agizo limesitishwa.',
            'order' => $order
        ]);
    }
}
