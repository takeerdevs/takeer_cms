<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\MessageSent;
use App\Models\Bundle;
use App\Models\ContentItem;
use App\Models\Merchant;
use App\Models\MerchantStaff;
use App\Models\Message;
use App\Models\OfferingGroup;
use App\Models\Order;
use App\Models\Post;
use App\Models\Product;
use App\Models\ReturnRequest;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use App\Services\ForwarderShipmentService;
use App\Services\SmsService;
use App\Support\MerchantPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MerchantOrderController extends Controller
{
    private const DELIVERY_STATUSES = [
        'packing',
        'ready_for_pickup',
        'dispatched',
        'with_boda',
        'in_transit',
        'arrived',
        'ready_at_terminal',
        'issue_reported',
    ];

    public function __construct(private readonly SmsService $smsService)
    {
    }

    /**
     * Return paginated orders for a specific merchant (owned by the authenticated user).
     */
    public function index(Request $request, Merchant $merchant): JsonResponse
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 100);

        $query = Order::with(['buyer', 'product.unitType', 'variant', 'returnRequest'])
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
                'display_image' => $display['image'] ?? null,
                'offering_group_selection' => $order->offering_group_selection ?? null,
                'is_escrow_order' => $display['is_escrow_order'],
                'is_inquiry' => (bool) $order->is_inquiry,
                'inquiry_status' => $order->inquiry_status,
                'merchant_confirmed_at' => $order->merchant_confirmed_at?->toISOString(),
                'is_merchant_confirmed' => $order->merchant_confirmed_at !== null,
                'shipping_fee' => $order->shipping_fee !== null ? (float) $order->shipping_fee : null,
                'return_request' => $order->returnRequest ? $this->returnRequestPayload($order->returnRequest) : null,
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
                    'active_members' => UserSubscription::where('merchant_id', $merchant->id)
                        ->where('status', 'active')
                        ->where(fn ($query) => $query
                            ->whereNull('current_period_end')
                            ->orWhere('current_period_end', '>', now()))
                        ->count(),
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

        $order->load(['buyer', 'product.unitType', 'variant', 'delivery.shippingZone', 'delivery.events.actor', 'merchant.locations', 'dispute', 'review', 'returnRequest']);
        $forwarderShipment = $order->delivery?->delivery_type === 'forwarder'
            ? app(ForwarderShipmentService::class)->createForTakeerOrder($order, $order->user_address_id)
            : null;
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
            'merchant' => $order->merchant ? [
                'id' => $order->merchant->id,
                'name' => $order->merchant->display_name,
                'username' => $order->merchant->username,
                'locations' => $order->merchant->locations->map(fn ($location) => [
                    'id' => $location->id,
                    'name' => $location->name,
                    'address' => $location->address,
                    'city' => $location->city,
                    'region' => $location->region,
                    'latitude' => $location->latitude !== null ? (float) $location->latitude : null,
                    'longitude' => $location->longitude !== null ? (float) $location->longitude : null,
                    'is_primary' => (bool) $location->is_primary,
                ])->values(),
            ] : null,
            'is_inquiry' => (bool) $order->is_inquiry,
            'inquiry_status' => $order->inquiry_status,
            'agreement_snapshot' => $order->agreement_snapshot,
            'agreed_at' => $order->agreed_at?->toISOString(),
            'merchant_confirmed_at' => $order->merchant_confirmed_at?->toISOString(),
            'is_merchant_confirmed' => $order->merchant_confirmed_at !== null,
            'paid_out_at' => $order->paid_out_at?->toISOString(),
            'shipping_fee' => $order->shipping_fee !== null ? (float) $order->shipping_fee : null,
            'custom_delivery' => [
                'file_url' => $order->custom_delivery_file_url,
                'file_name' => $order->custom_delivery_file_name,
                'file_mime' => $order->custom_delivery_file_mime,
                'file_size' => $order->custom_delivery_file_size !== null ? (int) $order->custom_delivery_file_size : null,
                'message' => $order->custom_delivery_message,
                'due_at' => $order->custom_delivery_due_at?->toISOString(),
                'delivered_at' => $order->custom_delivery_delivered_at?->toISOString(),
                'status' => $order->custom_delivery_status,
                'revision_message' => $order->custom_delivery_revision_message,
                'revision_requested_at' => $order->custom_delivery_revision_requested_at?->toISOString(),
                'revision_count' => (int) $order->custom_delivery_revision_count,
                'revision_limit' => Order::CUSTOM_DELIVERY_REVISION_LIMIT,
                'accepted_at' => $order->custom_delivery_accepted_at?->toISOString(),
            ],
            'bundle_item_selection' => $order->bundle_item_selection ?? [],
            'offering_group_selection' => $order->offering_group_selection ?? null,
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
                'shipping_zone' => $order->delivery->shippingZone ? [
                    'id' => $order->delivery->shippingZone->id,
                    'zone_name' => $order->delivery->shippingZone->zone_name,
                    'destination_city' => $order->delivery->shippingZone->destination_city,
                    'destination_region' => $order->delivery->shippingZone->destination_region,
                    'flat_rate_fee' => $order->delivery->shippingZone->flat_rate_fee,
                ] : null,
                'shipping_hotspot_id' => $order->delivery->shipping_hotspot_id,
                'confirmed_at' => $order->delivery->confirmed_at?->toISOString(),
                'delivered_at' => $order->delivery->delivered_at?->toISOString(),
                'boda_phone' => $order->delivery->boda_phone,
                'delivery_person_name' => $order->delivery->delivery_person_name,
                'bus_company' => $order->delivery->bus_company,
                'waybill_tracking_number' => $order->delivery->waybill_tracking_number,
                'waybill_photo_url' => $order->delivery->waybill_photo_url,
                'physical_address' => $order->delivery->physical_address,
                'forwarder_shipment_public_id' => $forwarderShipment?->public_id,
                'latitude' => $order->delivery->latitude,
                'longitude' => $order->delivery->longitude,
                'buyer_release_pin' => $order->delivery->buyer_release_pin,
                'pickup_pin' => $order->delivery->pickup_pin ? '****' : null, // keep it hidden for now, or maybe merchant needs it? No, merchant enters it.
                'pickup_location' => $order->delivery->pickup_location,
                'dropoff_location' => $order->delivery->dropoff_location,
                'buyer_unboxing_video_url' => $order->delivery->buyer_unboxing_video_url,
                'rider_access_expires_at' => $order->delivery->rider_access_expires_at?->toISOString(),
                'rider_access_active' => $order->delivery->rider_access_token_hash
                    && ! $order->delivery->rider_access_revoked_at
                    && (! $order->delivery->rider_access_expires_at || $order->delivery->rider_access_expires_at->isFuture()),
                'events' => $order->delivery->events->sortBy('created_at')->map(fn ($event) => [
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
                ])->values(),
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
                'reason' => $order->dispute->dispute_reason,
            ] : null,
            'return_request' => $order->returnRequest ? $this->returnRequestPayload($order->returnRequest) : null,
            'display_title' => $display['title'],
            'display_kind' => $display['kind'],
            'display_icon' => $display['icon'],
            'is_escrow_order' => $display['is_escrow_order'],
            'order_flow' => $display['is_escrow_order'] ? 'escrow' : 'instant',
        ]);
    }

    public function approveReturn(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        $returnRequest = $this->returnRequestForMerchant($request, $merchant, $order);

        $validated = $request->validate([
            'merchant_note' => 'nullable|string|max:2000',
        ]);

        abort_unless($returnRequest->status === ReturnRequest::STATUS_PENDING, 422, 'Return request cannot be approved from this state.');

        $returnRequest->update([
            'status' => ReturnRequest::STATUS_APPROVED,
            'merchant_note' => $validated['merchant_note'] ?? null,
            'approved_at' => now(),
        ]);

        return response()->json([
            'message' => 'Return request approved.',
            'return_request' => $this->returnRequestPayload($returnRequest->fresh()),
        ]);
    }

    public function rejectReturn(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        $returnRequest = $this->returnRequestForMerchant($request, $merchant, $order);

        $validated = $request->validate([
            'merchant_note' => 'required|string|max:2000',
        ]);

        abort_unless(in_array($returnRequest->status, [ReturnRequest::STATUS_PENDING, ReturnRequest::STATUS_APPROVED], true), 422, 'Return request cannot be rejected from this state.');

        $returnRequest->update([
            'status' => ReturnRequest::STATUS_REJECTED,
            'merchant_note' => $validated['merchant_note'],
            'rejected_at' => now(),
        ]);

        return response()->json([
            'message' => 'Return request rejected.',
            'return_request' => $this->returnRequestPayload($returnRequest->fresh()),
        ]);
    }

    public function markReturnReceived(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        $returnRequest = $this->returnRequestForMerchant($request, $merchant, $order);

        $validated = $request->validate([
            'merchant_note' => 'nullable|string|max:2000',
        ]);

        abort_unless($returnRequest->status === ReturnRequest::STATUS_APPROVED, 422, 'Approve the return before marking the item received.');

        $returnRequest->update([
            'status' => ReturnRequest::STATUS_ITEM_RECEIVED,
            'merchant_note' => $validated['merchant_note'] ?? $returnRequest->merchant_note,
            'received_at' => now(),
        ]);

        return response()->json([
            'message' => 'Returned item marked as received.',
            'return_request' => $this->returnRequestPayload($returnRequest->fresh()),
        ]);
    }

    public function completeReturn(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        $returnRequest = $this->returnRequestForMerchant($request, $merchant, $order);

        $validated = $request->validate([
            'resolution_type' => 'required|string|in:refund,replacement,store_credit,other',
            'merchant_note' => 'nullable|string|max:2000',
        ]);

        abort_unless(in_array($returnRequest->status, [ReturnRequest::STATUS_APPROVED, ReturnRequest::STATUS_ITEM_RECEIVED], true), 422, 'Return request cannot be completed from this state.');

        DB::transaction(function () use ($order, $returnRequest, $validated) {
            $returnRequest->update([
                'status' => ReturnRequest::STATUS_COMPLETED,
                'resolution_type' => $validated['resolution_type'],
                'merchant_note' => $validated['merchant_note'] ?? $returnRequest->merchant_note,
                'completed_at' => now(),
            ]);

            if ($validated['resolution_type'] === 'refund' && in_array($order->payment_status, ['escrow_locked', 'shipped', 'disputed'], true)) {
                $order->update(['payment_status' => 'resolved_buyer_refunded']);
                $wallet = $order->merchant->wallet()->firstOrCreate(
                    ['merchant_id' => $order->merchant_id],
                    ['user_id' => $order->merchant->user_id, 'balance' => 0, 'frozen_balance' => 0]
                );
                $fromFrozen = min((float) $order->total_paid, max(0, (float) $wallet->frozen_balance));
                if ($fromFrozen > 0) {
                    $wallet->decrement('frozen_balance', $fromFrozen);
                }
                $remaining = (float) $order->total_paid - $fromFrozen;
                if ($remaining > 0) {
                    $wallet->decrement('balance', $remaining);
                }
            }
        });

        return response()->json([
            'message' => 'Return request completed.',
            'return_request' => $this->returnRequestPayload($returnRequest->fresh()),
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

        $order->customDeliveryEvents()->create([
            'actor_type' => 'merchant',
            'actor_id' => $request->user()->id,
            'event_type' => 'delivery_uploaded',
            'revision_number' => (int) $order->custom_delivery_revision_count,
            'file_url' => 'private://'.$path,
            'file_name' => $originalName,
            'file_mime' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'message' => $validated['message'] ?? null,
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
                'image' => $order->product->image_url,
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
                'image' => $post?->cover_image_url,
                'is_escrow_order' => false,
            ];
        }

        if ($order->purchasable_type === 'content_item') {
            $content = ContentItem::find($order->purchasable_id);
            return [
                'title' => $content?->title ?: 'Post content',
                'kind' => 'post_content',
                'icon' => 'book_open',
                'image' => $content?->cover_image_url,
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
                'image' => $bundle?->cover_image_url,
                'is_escrow_order' => $isPhysicalBundle,
            ];
        }

        if ($order->purchasable_type === 'offering_group') {
            $group = OfferingGroup::find($order->purchasable_id);
            $selection = $order->offering_group_selection ?: [];
            $isPhysicalGroup = $order->requiresPhysicalFulfillment();

            return [
                'title' => $selection['group']['title'] ?? $group?->title ?? 'Offering group',
                'kind' => $isPhysicalGroup ? 'physical_bundle' : 'offering_group',
                'icon' => 'layers',
                'image' => $group?->cover_image_url,
                'is_escrow_order' => $isPhysicalGroup,
            ];
        }

        if ($order->purchasable_type === 'subscription_plan') {
            $plan = SubscriptionPlan::find($order->purchasable_id);
            return [
                'title' => $plan?->name ?: 'Membership plan',
                'kind' => 'subscription_plan',
                'icon' => 'crown',
                'image' => null,
                'is_escrow_order' => false,
            ];
        }

        return [
            'title' => $order->product?->title ?: 'Order item',
            'kind' => 'post_content',
            'icon' => 'book_open',
            'image' => $order->product?->image_url,
            'is_escrow_order' => false,
        ];
    }

    private function scopePhysicalFulfillmentOrders($query)
    {
        return $query->where(function ($query) {
            $query->where(function ($productQuery) {
                $productQuery->where('purchasable_type', 'product')
                    ->whereHas('product', fn($product) => $product->where('type', 'physical'));
            })->orWhere('purchasable_type', 'bundle')
                ->orWhere('purchasable_type', 'offering_group');
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
            'delivery_person_name' => 'nullable|string|max:120',
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

        $status = $deliveryType === 'local_boda' ? 'with_boda' : 'in_transit';

        $delivery->fill([
            'delivery_status' => $status,
            'delivery_type' => $deliveryType,
            'boda_phone' => $validated['boda_phone'] ?? $delivery->boda_phone,
            'delivery_person_name' => $validated['delivery_person_name'] ?? $delivery->delivery_person_name,
            'bus_company' => $validated['bus_company'] ?? $delivery->bus_company,
            'waybill_tracking_number' => $validated['waybill_tracking_number'] ?? $delivery->waybill_tracking_number,
            'waybill_photo_url' => $validated['waybill_photo_url'] ?? $delivery->waybill_photo_url,
            'buyer_release_pin' => $delivery->buyer_release_pin ?: str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT),
        ])->save();

        $delivery->events()->create([
            'order_id' => $order->id,
            'status' => $status,
            'actor_type' => 'merchant',
            'actor_user_id' => $request->user()->id,
            'proof_url' => $validated['merchant_dispatch_video_url'] ?? null,
            'proof_mime' => null,
            'proof_type' => null,
            'note' => $mode === 'intercity' ? 'Intercity dispatch confirmed.' : 'Local delivery dispatched.',
            'metadata' => array_filter([
                'mode' => $mode,
                'boda_phone' => $delivery->boda_phone,
                'delivery_person_name' => $delivery->delivery_person_name,
                'bus_company' => $delivery->bus_company,
                'waybill_tracking_number' => $delivery->waybill_tracking_number,
                'waybill_photo_url' => $delivery->waybill_photo_url,
            ]),
        ]);

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

    public function generateRiderAccess(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($this->canOperateMerchant($request, $merchant), 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        abort_unless($order->requiresPhysicalFulfillment(), 422, 'Rider links are available for physical orders only.');
        abort_unless($order->delivery, 422, 'Delivery details are not available for this order.');
        abort_if($order->delivery->delivery_type === 'self_pickup', 422, 'Self-pickup orders do not need a rider link.');
        abort_unless(in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'disputed'], true), 422, 'Order must be paid before sharing a rider link.');

        $validated = $request->validate([
            'expires_in_hours' => ['nullable', 'integer', 'min:1', 'max:72'],
        ]);

        $token = Str::random(48);
        $expiresAt = now()->addHours((int) ($validated['expires_in_hours'] ?? 24));

        $order->delivery->update([
            'buyer_release_pin' => $order->delivery->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT),
            'rider_access_token_hash' => hash('sha256', $token),
            'rider_access_expires_at' => $expiresAt,
            'rider_access_revoked_at' => null,
        ]);

        return response()->json([
            'message' => 'Rider link imetengenezwa.',
            'url' => url("/rider/delivery/{$token}"),
            'expires_at' => $expiresAt->toISOString(),
        ]);
    }

    public function updateDeliveryStatus(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($this->canOperateMerchant($request, $merchant), 403);
        abort_unless($order->merchant_id === $merchant->id, 404);
        abort_unless($order->requiresPhysicalFulfillment(), 422, 'Delivery updates are available for physical orders only.');
        abort_unless(in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked', 'shipped', 'disputed'], true), 422, 'Order must be paid before delivery status can be updated.');

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', self::DELIVERY_STATUSES)],
            'note' => ['nullable', 'string', 'max:1000'],
            'proof' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska', 'max:51200'],
            'proofs' => ['nullable', 'array', 'max:10'],
            'proofs.*' => ['file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm,video/x-matroska', 'max:51200'],
            'courier_receipt' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf', 'max:51200'],
            'bus_company' => ['nullable', 'string', 'max:120'],
            'waybill_tracking_number' => ['nullable', 'string', 'max:100'],
            'tracking_link' => ['nullable', 'url', 'max:500'],
            'forwarder_evidence_type' => ['nullable', 'string', 'in:tracked_courier,manual_forwarder,takeer_verified_forwarder'],
            'boda_phone' => ['nullable', 'string', 'max:80'],
            'delivery_person_name' => ['nullable', 'string', 'max:120'],
        ]);

        abort_if(
            $order->delivery?->delivery_type === 'self_pickup' && ! in_array($validated['status'], ['ready_for_pickup', 'issue_reported'], true),
            422,
            'Self-pickup orders can only be marked ready for pickup or issue reported here.'
        );
        if (($validated['status'] ?? null) !== 'issue_reported' && $order->delivery?->delivery_type !== 'self_pickup') {
            $currentIndex = $this->deliveryStepIndex($order->delivery?->delivery_status, $order->delivery?->delivery_type);
            $nextIndex = $this->deliveryStepIndex($validated['status'], $order->delivery?->delivery_type);
            abort_if($nextIndex < $currentIndex || $nextIndex > $currentIndex + 1, 422, 'Delivery status must move in sequence.');
        }

        $proofUrl = null;
        $proofMime = null;
        $proofType = null;
        $proofMedia = [];
        $proofFiles = [];
        if ($request->hasFile('proof')) {
            $proofFiles[] = $request->file('proof');
        }
        foreach ($request->file('proofs', []) as $file) {
            if ($file) {
                $proofFiles[] = $file;
            }
        }

        foreach ($proofFiles as $index => $file) {
            $path = $file->store('delivery-events', 'public');
            $mime = $file->getClientMimeType();
            $type = str_starts_with((string) $mime, 'image/') ? 'photo' : 'video';
            $url = Storage::disk('public')->url($path);
            $proofMedia[] = [
                'url' => $url,
                'mime' => $mime,
                'type' => $type,
                'name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
            ];

            if ($index === 0) {
                $proofUrl = $url;
                $proofMime = $mime;
                $proofType = $type;
            }
        }
        $courierReceiptUrl = null;
        $courierReceiptMime = null;
        if ($request->hasFile('courier_receipt')) {
            $file = $request->file('courier_receipt');
            $path = $file->store('delivery-events', 'public');
            $courierReceiptUrl = Storage::disk('public')->url($path);
            $courierReceiptMime = $file->getClientMimeType();
            $proofMedia[] = [
                'url' => $courierReceiptUrl,
                'mime' => $courierReceiptMime,
                'type' => str_starts_with((string) $courierReceiptMime, 'image/') ? 'photo' : 'document',
                'name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'role' => 'courier_receipt',
            ];

            if (! $proofUrl) {
                $proofUrl = $courierReceiptUrl;
                $proofMime = $courierReceiptMime;
                $proofType = str_starts_with((string) $courierReceiptMime, 'image/') ? 'photo' : 'document';
            }
        }

        $delivery = DB::transaction(function () use ($order, $request, $validated, $proofUrl, $proofMime, $proofType, $proofMedia, $courierReceiptUrl) {
            $delivery = $order->delivery()->firstOrNew(['order_id' => $order->id]);
            $delivery->fill([
                'delivery_status' => $validated['status'],
                'delivery_type' => $delivery->delivery_type ?: 'local_boda',
                'boda_phone' => $validated['boda_phone'] ?? $delivery->boda_phone,
                'delivery_person_name' => $validated['delivery_person_name'] ?? $delivery->delivery_person_name,
                'bus_company' => $validated['bus_company'] ?? $delivery->bus_company,
                'waybill_tracking_number' => $validated['waybill_tracking_number'] ?? $delivery->waybill_tracking_number,
                'waybill_photo_url' => $courierReceiptUrl ?? $delivery->waybill_photo_url,
                'buyer_release_pin' => $delivery->delivery_type === 'forwarder'
                    ? null
                    : ($delivery->buyer_release_pin ?: str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT)),
            ])->save();

            $delivery->events()->create([
                'order_id' => $order->id,
                'status' => $validated['status'],
                'actor_type' => 'merchant',
                'actor_user_id' => $request->user()->id,
                'proof_url' => $proofUrl,
                'proof_mime' => $proofMime,
                'proof_type' => $proofType,
                'note' => $validated['note'] ?? null,
                'metadata' => array_filter([
                    'boda_phone' => $validated['boda_phone'] ?? null,
                    'delivery_person_name' => $validated['delivery_person_name'] ?? null,
                    'courier_company' => $validated['bus_company'] ?? null,
                    'bus_company' => $validated['bus_company'] ?? null,
                    'waybill_tracking_number' => $validated['waybill_tracking_number'] ?? null,
                    'tracking_link' => $validated['tracking_link'] ?? null,
                    'forwarder_evidence_type' => $validated['forwarder_evidence_type'] ?? null,
                    'courier_receipt_url' => $courierReceiptUrl,
                    'proofs' => $proofMedia ?: null,
                ]),
            ]);

            if (
                in_array($validated['status'], ['dispatched', 'with_boda', 'in_transit', 'arrived', 'ready_at_terminal'], true)
                && $order->payment_status === 'awaiting_merchant_confirmation'
            ) {
                $order->update([
                    'payment_status' => 'escrow_locked',
                    'merchant_confirmed_at' => $order->merchant_confirmed_at ?: now(),
                ]);
            }

            if ($delivery->delivery_type === 'forwarder') {
                app(ForwarderShipmentService::class)->syncFromOrderDelivery($order->fresh('delivery'), $request->user()->id);
            }

            return $delivery->fresh(['events.actor']);
        });
        $this->appendDeliveryChatUpdate($order->fresh(['merchant.user', 'buyer', 'delivery']), $validated['status'], $validated['note'] ?? null, $proofUrl, $proofMedia, [
            'courier_company' => $validated['bus_company'] ?? null,
            'bus_company' => $validated['bus_company'] ?? null,
            'waybill_tracking_number' => $validated['waybill_tracking_number'] ?? null,
            'tracking_link' => $validated['tracking_link'] ?? null,
            'forwarder_evidence_type' => $validated['forwarder_evidence_type'] ?? null,
            'courier_receipt_url' => $courierReceiptUrl,
        ]);

        return response()->json([
            'message' => 'Delivery status imehifadhiwa.',
            'delivery' => [
                'id' => $delivery->id,
                'delivery_status' => $delivery->delivery_status,
                'status' => $delivery->delivery_status,
                'delivery_type' => $delivery->delivery_type,
                'type' => $delivery->delivery_type,
                'boda_phone' => $delivery->boda_phone,
                'delivery_person_name' => $delivery->delivery_person_name,
                'events' => $delivery->events->sortBy('created_at')->map(fn ($event) => [
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
                ])->values(),
            ],
        ]);
    }

    private function deliveryStepIndex(?string $status, ?string $type): int
    {
        $steps = match ($type) {
            'forwarder' => ['packing', 'with_boda', 'ready_at_terminal'],
            'intercity_bus' => ['with_boda', 'in_transit', 'ready_at_terminal', 'delivered'],
            default => ['with_boda', 'in_transit', 'arrived', 'delivered'],
        };

        $index = array_search($status, $steps, true);

        return $index === false ? -1 : (int) $index;
    }

    private function appendDeliveryChatUpdate(Order $order, string $status, ?string $note = null, ?string $proofUrl = null, array $proofMedia = [], array $metadata = []): void
    {
        $senderId = $order->merchant?->user_id;
        if (! $senderId || ! $order->buyer_id) {
            return;
        }

        $message = Message::create([
            'order_id' => $order->id,
            'sender_id' => $senderId,
            'receiver_id' => $order->buyer_id,
            'type' => 'action',
            'body' => 'Delivery status updated: ' . str_replace('_', ' ', $status),
            'media_url' => $proofUrl,
            'payload' => [
                'action_type' => 'delivery_status_update',
                'status' => $status,
                'note' => $note,
                'proof_url' => $proofUrl,
                'proofs' => $proofMedia,
                ...array_filter($metadata),
                'actor_type' => 'merchant',
                'boda_phone' => $order->delivery?->boda_phone,
                'delivery_person_name' => $order->delivery?->delivery_person_name,
            ],
        ]);
        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();
    }

    /**
     * Verify pickup using Customer's PIN.
     * On success: escrow released to merchant wallet, order marked complete.
     */
    public function verifyPickup(Request $request, Merchant $merchant, Order $order): JsonResponse
    {
        abort_unless($this->canOperateMerchant($request, $merchant), 403);
        abort_unless($order->merchant_id === $merchant->id, 404);

        $validated = $request->validate(['pickup_pin' => 'required|string']);

        if (!$order->delivery || $order->delivery->pickup_pin !== $validated['pickup_pin']) {
            return response()->json(['message' => 'PIN sio sahihi. Tafadhali hakiki upya.'], 400);
        }

        abort_unless(
            in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked'], true),
            422,
            'Order must be paid before pickup can be released.'
        );

        $chatMessage = null;

        DB::transaction(function () use ($order, $merchant, $request, &$chatMessage) {
            $order->delivery->update(['delivery_status' => 'delivered']);
            $order->delivery->events()->create([
                'order_id' => $order->id,
                'status' => 'delivered',
                'actor_type' => 'merchant',
                'actor_user_id' => $request->user()->id,
                'note' => 'Pickup PIN verified.',
            ]);

            app(\App\Services\WalletService::class)->releaseEscrowToMerchant($order);
            app(\App\Services\EntitlementService::class)->grantForOrder($order->fresh(['product']));

            $activeStaff = $this->activeStaffContext($request, $merchant);
            $actorName = $request->user()->name ?: ($merchant->business_name ?: $merchant->username);
            $merchantName = $merchant->business_name ?: $merchant->username;

            $message = Message::create([
                'order_id' => $order->id,
                'sender_id' => $request->user()->id,
                'receiver_id' => $order->buyer_id,
                'type' => 'action',
                'body' => "{$actorName} verified pickup for {$merchantName} and released this order.",
                'payload' => [
                    'action_type' => 'pickup_verified',
                    'acting_as' => 'merchant',
                    'actor_name' => $actorName,
                    'actor_user_id' => $request->user()->id,
                    'actor_staff_id' => $activeStaff?->id,
                    'actor_staff_role' => $activeStaff?->role,
                    'merchant_name' => $merchantName,
                    'merchant_id' => $merchant->id,
                    'verified_at' => now()->toISOString(),
                ],
            ]);

            $message->load('sender:id,name,role');
            broadcast(new MessageSent($message, $order))->toOthers();
            $chatMessage = $message;
        });

        $freshOrder = $order->fresh(['buyer:id,name,phone_number', 'product:id,title,type,url,download_link', 'product.images', 'variant:id,name,swatch_image_url', 'delivery']);

        return response()->json([
            'message' => 'Mzigo umekabidhiwa kikamilifu! Malipo yameidhinishwa.',
            'order' => $this->checkupPayload($freshOrder),
            'chat_message' => $chatMessage,
        ]);
    }

    public function checkupLookup(Request $request, Merchant $merchant): JsonResponse
    {
        abort_unless($this->canOperateMerchant($request, $merchant), 403);

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:64'],
        ]);

        $code = strtoupper(trim((string) $validated['code']));
        $digitsOnly = preg_replace('/\D+/', '', $code);

        $order = Order::query()
            ->with(['buyer:id,name,phone_number', 'product:id,title,type,url,download_link', 'product.images', 'variant:id,name,swatch_image_url', 'delivery'])
            ->where('merchant_id', $merchant->id)
            ->where(function ($query) use ($code, $digitsOnly) {
                $query->where('public_id', $code)
                    ->orWhere('transaction_ref', $code)
                    ->orWhere('pickup_code', $code)
                    ->orWhereHas('delivery', function ($deliveryQuery) use ($code, $digitsOnly) {
                        $deliveryQuery->where('pickup_pin', $code);
                        if ($digitsOnly && $digitsOnly !== $code) {
                            $deliveryQuery->orWhere('pickup_pin', $digitsOnly);
                        }
                    });
            })
            ->orderByRaw("CASE payment_status WHEN 'awaiting_merchant_confirmation' THEN 0 WHEN 'escrow_locked' THEN 1 WHEN 'shipped' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END")
            ->latest()
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Oda haijapatikana kwa code hiyo.'], 404);
        }

        return response()->json([
            'order' => $this->checkupPayload($order),
        ]);
    }

    private function checkupPayload(Order $order): array
    {
        $display = $this->resolveDisplay($order);
        $phone = (string) ($order->buyer?->phone_number ?: $order->account_phone ?: $order->customer_phone ?: '');
        $maskedPhone = $phone !== ''
            ? substr($phone, 0, 4) . '***' . substr($phone, -3)
            : null;
        $deliveryType = $order->delivery?->delivery_type;
        $isPickup = $deliveryType === 'self_pickup' || filled($order->delivery?->pickup_pin);
        $isPaidForRelease = in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked'], true);
        $canVerifyPickup = $isPickup
            && $isPaidForRelease
            && $order->delivery?->pickup_pin;
        $amountPaid = $isPaidForRelease || in_array($order->payment_status, ['shipped', 'disputed', 'resolved_merchant_paid'], true)
            ? (float) $order->total_paid
            : 0.0;
        $amountRemaining = max(0, (float) $order->total_paid - $amountPaid);

        return [
            'id' => $order->id,
            'public_id' => $order->public_id,
            'title' => $display['title'] ?: ($order->product?->title ?? 'Order'),
            'kind' => $display['kind'],
            'image_url' => $display['image'] ?? ($order->variant?->swatch_image_url ?: $order->product?->image_url),
            'payment_status' => $order->payment_status,
            'delivery_type' => $isPickup ? 'self_pickup' : $deliveryType,
            'delivery_status' => $isPickup && in_array($order->delivery?->delivery_status, ['awaiting_boda', 'inquiry', null], true)
                ? 'awaiting_pickup'
                : $order->delivery?->delivery_status,
            'total_paid' => (float) $order->total_paid,
            'amount_total' => (float) $order->total_paid,
            'amount_paid' => $amountPaid,
            'amount_remaining' => $amountRemaining,
            'quantity' => (float) ($order->quantity ?: 1),
            'items' => $this->checkupItems($order),
            'customer_name' => $order->buyer?->name,
            'customer_phone' => $maskedPhone,
            'has_pickup_pin' => (bool) $order->delivery?->pickup_pin,
            'can_verify_pickup' => (bool) $canVerifyPickup,
            'release_blocked_reason' => $canVerifyPickup ? null : $this->checkupReleaseBlockedReason($order, $isPickup),
            'chat_url' => $order->public_id ? "/chat/{$order->public_id}?acting_as=merchant" : null,
            'created_at' => $order->created_at?->toISOString(),
        ];
    }

    private function checkupItems(Order $order): array
    {
        if ($order->purchasable_type === 'offering_group' && !empty($order->offering_group_selection['lines'])) {
            return collect($this->flattenOfferingGroupLines($order->offering_group_selection['lines']))
                ->map(fn (array $line, int $index) => [
                    'key' => 'offering-'.$index,
                    'title' => $line['title'] ?? 'Offering item',
                    'image_url' => $line['image_url'] ?? null,
                    'quantity' => (float) ($line['quantity'] ?? 1),
                    'unit_price' => (float) ($line['unit_price'] ?? 0),
                    'line_total' => (float) ($line['line_total'] ?? 0),
                    'type' => $line['product_type'] ?? $line['item_type'] ?? null,
                    'is_main' => $index === 0,
                ])
                ->values()
                ->all();
        }

        $items = [[
            'key' => 'main',
            'title' => $this->resolveDisplay($order)['title'] ?: ($order->product?->title ?? 'Order item'),
            'image_url' => $order->variant?->swatch_image_url ?: $order->product?->image_url,
            'quantity' => (float) ($order->quantity ?: 1),
            'unit_price' => (float) ($order->unit_price ?: $order->total_paid),
            'line_total' => (float) ($order->unit_price ?: $order->total_paid) * (float) ($order->quantity ?: 1),
            'type' => $order->product?->type,
            'is_main' => true,
        ]];

        foreach (($order->extra_items ?? []) as $index => $item) {
            $type = $item['type'] ?? $item['product_type'] ?? null;
            $quantity = $type === 'physical' ? (float) ($item['quantity'] ?? 1) : 1.0;
            $unitPrice = (float) ($item['price'] ?? 0);

            $items[] = [
                'key' => 'extra-'.$index,
                'title' => $item['title'] ?? 'Added item',
                'image_url' => $item['image'] ?? null,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'line_total' => $unitPrice * $quantity,
                'type' => $type,
                'is_main' => false,
            ];
        }

        return $items;
    }

    private function flattenOfferingGroupLines(array $lines): array
    {
        $flat = [];

        foreach ($lines as $line) {
            $flat[] = $line;
            if (!empty($line['child_lines']) && is_array($line['child_lines'])) {
                $flat = array_merge($flat, $this->flattenOfferingGroupLines($line['child_lines']));
            }
        }

        return $flat;
    }

    private function checkupReleaseBlockedReason(Order $order, bool $isPickup): string
    {
        if (! $isPickup) {
            return 'This order is not a pickup order.';
        }

        if (! in_array($order->payment_status, ['awaiting_merchant_confirmation', 'escrow_locked'], true)) {
            return 'Payment is not complete yet. Complete payment before releasing this order.';
        }

        if (! $order->delivery?->pickup_pin) {
            return 'Pickup PIN is not available for this order.';
        }

        return 'This order cannot be released from this code right now.';
    }

    private function canOperateMerchant(Request $request, Merchant $merchant): bool
    {
        if ((int) $merchant->user_id === (int) $request->user()->id) {
            return true;
        }

        return $this->activeStaffContext($request, $merchant) !== null;
    }

    private function activeStaffContext(Request $request, Merchant $merchant): ?MerchantStaff
    {
        return MerchantStaff::query()
            ->where('merchant_id', $merchant->id)
            ->where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->first();
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

        \Illuminate\Support\Facades\DB::transaction(function () use ($order, $merchant, $request) {
            $order->delivery->update(['delivery_status' => 'delivered']);
            $order->delivery->events()->create([
                'order_id' => $order->id,
                'status' => 'delivered',
                'actor_type' => 'merchant',
                'actor_user_id' => $request->user()->id,
                'note' => 'Buyer release PIN verified.',
            ]);

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
        $order->loadMissing(['merchant', 'buyer', 'product', 'delivery']);
        if (!$order->merchant || !MerchantPermissions::can($user, $order->merchant, 'orders.update')) {
            abort(403, 'Unauthorized.');
        }

        if ($order->payment_status !== 'pending') {
            return response()->json(['message' => 'Malipo yameshaanza au yamekamilika. Huwezi kubadilisha gharama ya usafiri.'], 422);
        }

        $validated = $request->validate([
            'unit_price' => 'nullable|numeric|min:0',
            'shipping_fee' => 'nullable|numeric|min:0',
            'message' => 'nullable|string|max:500',
        ]);

        $previousShippingFee = $order->shipping_fee !== null ? (float) $order->shipping_fee : null;
        $previousTotalPaid = (float) ($order->total_paid ?? 0);
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
            'merchant_confirmed_at' => now(),
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

        $customMessage = trim((string) ($validated['message'] ?? ''));
        $shippingChanged = !$isServiceOrder && $previousShippingFee !== null && abs($previousShippingFee - $shippingFee) >= 0.01;
        $body = $customMessage !== '' ? $customMessage : ($isServiceOrder
            ? "Nimetuma offer ya huduma: TZS " . number_format($totalPaid) . ". Tafadhali fanya malipo kukamilisha booking."
            : ($shippingChanged
                ? "Nimesasisha gharama ya usafiri kutoka TZS " . number_format($previousShippingFee) . " kwenda TZS " . number_format($shippingFee) . ". Jumla mpya ni TZS " . number_format($totalPaid) . "."
                : "Nimesasisha bei. Bei ya bidhaa: TZS " . number_format($unitPrice) . ", Gharama ya usafiri: TZS " . number_format($shippingFee) . ". Tafadhali fanya malipo kukamilisha agizo."));

        $message = $order->messages()->create([
            'sender_id' => $user->id,
            'receiver_id' => $order->buyer_id,
            'body' => $body,
            'type' => 'system',
            'payload' => [
                'action_type' => $shippingChanged ? 'shipping_fee_updated' : 'shipping_quote_sent',
                'acting_as' => 'merchant',
                'previous_shipping_fee' => $previousShippingFee,
                'shipping_fee' => $shippingFee,
                'previous_total_paid' => $previousTotalPaid,
                'total_paid' => $totalPaid,
            ],
            'is_system' => true,
        ]);
        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();

        if ($order->buyer?->phone_number) {
            $this->smsService->sendPhysicalQuoteReady(
                $order->buyer->phone_number,
                (string) ($order->public_id ?: $order->id),
                (float) $order->total_paid,
                $order->buyer_id
            );
        }

        return response()->json([
            'message' => $shippingChanged ? 'Shipping amount updated.' : 'Quote sent to the buyer.',
            'order' => $order->fresh(['buyer', 'product', 'variant', 'delivery']),
        ]);
    }

    public function confirmAvailability(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        $order->loadMissing(['merchant', 'buyer', 'product', 'delivery']);
        if (!$order->merchant || !MerchantPermissions::can($user, $order->merchant, 'orders.update')) {
            abort(403, 'Unauthorized.');
        }

        if (!$order->is_inquiry || $order->payment_status !== 'pending') {
            return response()->json(['message' => 'Order hii haiwezi kuthibitishwa kwa sasa.'], 422);
        }

        $deliveryType = $order->delivery?->delivery_type;
        $hasShippingTerms = $order->product?->isService()
            || $deliveryType === 'self_pickup'
            || $order->shipping_fee !== null
            || $order->delivery?->shipping_zone_id;

        if (!$hasShippingTerms) {
            return response()->json(['message' => 'Weka gharama ya usafiri kwanza kabla ya kuthibitisha order.'], 422);
        }

        $order->update([
            'inquiry_status' => 'quoted',
            'merchant_confirmed_at' => now(),
            'agreement_snapshot' => array_filter([
                ...(is_array($order->agreement_snapshot) ? $order->agreement_snapshot : []),
                'unit_price' => (float) $order->unit_price,
                'shipping_fee' => $order->shipping_fee !== null ? (float) $order->shipping_fee : null,
                'total_paid' => (float) $order->total_paid,
                'delivery_type' => $deliveryType,
                'physical_address' => $order->delivery?->physical_address,
                'offered_by' => 'merchant',
                'offered_at' => now()->toISOString(),
                'merchant_confirmed_at' => now()->toISOString(),
            ], fn ($value) => $value !== null),
            'agreed_at' => null,
        ]);

        $message = $order->messages()->create([
            'sender_id' => $user->id,
            'receiver_id' => $order->buyer_id,
            'body' => 'Nimethibitisha kuwa order ipo tayari. Unaweza kulipia sasa.',
            'is_system' => false,
        ]);
        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();

        if ($order->buyer?->phone_number) {
            $this->smsService->sendPhysicalQuoteReady(
                $order->buyer->phone_number,
                (string) ($order->public_id ?: $order->id),
                (float) $order->total_paid,
                $order->buyer_id
            );
        }

        return response()->json([
            'message' => 'Order imethibitishwa. Mteja anaweza kulipia sasa.',
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

        $previousExpiresAt = $order->expires_at;
        $baseExpiresAt = ($previousExpiresAt && !$previousExpiresAt->isPast()) ? $previousExpiresAt->copy() : now();
        $newExpiresAt = $baseExpiresAt->addMinutes(30);

        $order->update(['expires_at' => $newExpiresAt]);

        $merchantName = $merchant->storefrontSetting?->store_name
            ?: $merchant->business_name
            ?: $merchant->user?->name
            ?: 'Merchant';

        $message = $order->messages()->create([
            'sender_id' => $request->user()->id,
            'receiver_id' => $order->buyer_id,
            'type' => 'system',
            'body' => "{$merchantName} added 30 minutes to the order time left.",
            'payload' => [
                'action_type' => 'order_time_extended',
                'acting_as' => 'merchant',
                'minutes_added' => 30,
                'merchant_name' => $merchantName,
                'previous_expires_at' => $previousExpiresAt?->toISOString(),
                'new_expires_at' => $newExpiresAt->toISOString(),
            ],
        ]);

        $message->load('sender:id,name,role');
        broadcast(new MessageSent($message, $order))->toOthers();

        return response()->json([
            'message' => 'Muda wa lock umeongezwa kwa dakika 30.',
            'order' => $order->fresh()->load(['product.unitType', 'product.images', 'merchant.locations', 'delivery', 'dispute', 'review']),
            'messages' => $order->messages()->with(['sender:id,name,role'])->oldest()->get(),
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

    private function returnRequestForMerchant(Request $request, Merchant $merchant, Order $order): ReturnRequest
    {
        abort_unless($merchant->user_id === $request->user()->id, 403);
        abort_unless($order->merchant_id === $merchant->id, 404);

        $returnRequest = $order->returnRequest()->first();
        abort_unless($returnRequest, 404, 'Return request not found for this order.');

        return $returnRequest;
    }

    private function returnRequestPayload(ReturnRequest $returnRequest): array
    {
        return [
            'id' => $returnRequest->id,
            'status' => $returnRequest->status,
            'resolution_type' => $returnRequest->resolution_type,
            'reason' => $returnRequest->reason,
            'evidence_url' => $returnRequest->evidence_url,
            'policy_snapshot' => $returnRequest->policy_snapshot,
            'merchant_note' => $returnRequest->merchant_note,
            'customer_note' => $returnRequest->customer_note,
            'requested_at' => $returnRequest->requested_at?->toISOString(),
            'approved_at' => $returnRequest->approved_at?->toISOString(),
            'rejected_at' => $returnRequest->rejected_at?->toISOString(),
            'received_at' => $returnRequest->received_at?->toISOString(),
            'completed_at' => $returnRequest->completed_at?->toISOString(),
            'escalated_at' => $returnRequest->escalated_at?->toISOString(),
            'dispute_id' => $returnRequest->dispute_id,
        ];
    }
}
