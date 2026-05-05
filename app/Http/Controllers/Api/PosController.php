<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PosSaleItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProductLocationInventory;
use App\Models\RetailAuditLog;
use App\Models\MerchantLocation;
use App\Models\StockTransfer;
use App\Models\MerchantStaff;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PosController extends Controller
{
    private function locationInventoryQuery(int $locationId, int $productId, ?int $variantId)
    {
        $query = ProductLocationInventory::where('merchant_location_id', $locationId);

        if ($variantId) {
            return $query->where('product_variant_id', $variantId)
                ->where(function ($q) use ($productId) {
                    $q->where('product_id', $productId)
                        ->orWhereNull('product_id');
                });
        }

        return $query->where('product_id', $productId)
            ->whereNull('product_variant_id');
    }

    private function activeRetailStaff(Request $request, $merchant): ?MerchantStaff
    {
        $user = $request->user();
        if (!$user) return null;

        return MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Search products for POS.
     */
    public function searchProducts(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $query = $request->input('q');
        $locationId = $request->input('location_id');
        $activeStaff = $this->activeRetailStaff($request, $merchant);

        if ($activeStaff && strtoupper((string) $activeStaff->role) !== 'MANAGER') {
            $assignedLocationId = (int) ($activeStaff->assigned_location_id ?? 0);
            if ($assignedLocationId > 0) {
                $locationId = $assignedLocationId;
            }
        }

        $productsQuery = Product::where('merchant_id', $merchant->id)
            ->with(['unitType', 'variants.locationInventories.location', 'attributes.categoryRelation', 'attributes.brand', 'attributes.model', 'categoryAttributeValues.categoryAttribute', 'locationInventories' => function($q) use ($locationId) {
                if ($locationId) $q->where('merchant_location_id', $locationId);
            }])
            ->withCount(['orders' => function($q) {
                $q->where('payment_status', 'resolved_merchant_paid');
            }]);

        if (filled($query)) {
            $productsQuery->where(function($q) use ($query) {
                $q->where('title', 'LIKE', "%{$query}%")
                  ->orWhere('slug', 'LIKE', "%{$query}%")
                  ->orWhereHas('variants', function($vq) use ($query) {
                      $vq->where('sku', 'LIKE', "%{$query}%")
                        ->orWhere('name', 'LIKE', "%{$query}%");
                  })
                  ->orWhereHas('attributes', function($aq) use ($query) {
                      $aq->whereHas('brand', function($bq) use ($query) {
                          $bq->where('name', 'LIKE', "%{$query}%");
                      })->orWhereHas('model', function($mq) use ($query) {
                          $mq->where('name', 'LIKE', "%{$query}%");
                      });
                  });
            });
            // If searching, order by relevance (titles first potentially, but simple ID DESC for now)
            $productsQuery->orderByDesc('id');
        } else {
            // If no search, show most sellable and latest
            $productsQuery->orderByDesc('orders_count')
                          ->orderByDesc('views_count')
                          ->orderByDesc('id');
        }

        $products = $productsQuery->limit(24)->get();

        return response()->json(['data' => \App\Http\Resources\ProductResource::collection($products)]);
    }

    /**
     * Store a POS sale.
     */
    public function storeSale(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        
        $validated = $request->validate([
            'location_id' => 'required|exists:merchant_locations,id',
            'staff_id' => 'required|exists:merchant_staffs,id',
            'payment_mode' => 'required|in:cash,merchant_mm,online_escrow,store_credit',
            'customer_name' => 'nullable|string|max:255',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.variant_id' => 'nullable|exists:product_variants,id',
            'items.*.quantity' => 'required|numeric|min:0.001',
            'items.*.unit_price' => 'required|numeric',
            'items.*.source_location_id' => 'nullable|exists:merchant_locations,id',
            'total_amount' => 'required|numeric',
            'amount_paid' => 'required|numeric',
            'payment_mode' => 'required|string|in:cash,merchant_mm,online_escrow,store_credit',
            'discount_amount' => 'nullable|numeric',
            'manager_pin' => 'nullable|string',
            'customer_name' => 'nullable|string',
            'customer_phone' => 'nullable|string',
            'order_id' => 'nullable|exists:orders,id',
            'status' => 'nullable|string|in:pending_approval',
        ]);

        $merchant = $request->attributes->get('active_merchant');
        
        // If updating existing order
        if (!empty($validated['order_id'])) {
            $existingOrder = Order::where('id', $validated['order_id'])
                ->where('merchant_id', $merchant->id)
                ->first();
            
            if ($existingOrder && $existingOrder->payment_status === 'resolved_merchant_paid') {
                return response()->json(['message' => 'Oda hii tayari imekamilika.'], 400);
            }
        }

        // Security check: staff must belong to this merchant
        $staff = \App\Models\MerchantStaff::find($validated['staff_id']);
        if ($staff->merchant_id !== $merchant->id) {
            return response()->json(['message' => 'Mhudumu huyu hajasajiliwa kwenye biashara yako.'], 403);
        }

        $activeStaff = $this->activeRetailStaff($request, $merchant);
        if ($activeStaff && strtoupper((string) $activeStaff->role) !== 'MANAGER') {
            // Non-managers can only checkout from their assigned location.
            $assignedLocationId = (int) ($activeStaff->assigned_location_id ?? 0);
            if ($assignedLocationId > 0 && (int) $validated['location_id'] !== $assignedLocationId) {
                return response()->json(['message' => 'Huwezi kutumia location nyingine. Tumia location uliyopewa.'], 403);
            }
        }

        $checkoutLocationId = (int) $validated['location_id'];
        $requiresTransferFlow = collect($validated['items'])->contains(
            fn($item) => (int) ($item['source_location_id'] ?? $checkoutLocationId) !== $checkoutLocationId
        );

        // 1. Manager PIN check for payment overrides (skip for transfer-flow requests)
        $isPendingApproval = ($validated['status'] ?? '') === 'pending_approval';
        $hasDiscount = ((float) ($validated['discount_amount'] ?? 0)) > 0;
        $isPayLater = ($validated['payment_mode'] ?? null) === 'store_credit';
        $hasOutstandingBalance = ((float) ($validated['amount_paid'] ?? 0)) < ((float) ($validated['total_amount'] ?? 0));
        if (($isPayLater || $hasOutstandingBalance) && (blank($validated['customer_name'] ?? null) || blank($validated['customer_phone'] ?? null))) {
            return response()->json([
                'message' => 'Taarifa za mteja zinahitajika kwa Pay Later au oda yenye salio.',
            ], 422);
        }

        $isOverridden = $hasDiscount || $isPayLater;
        
        $staffRole = strtoupper((string) ($staff->role ?? ''));
        if ($isOverridden && !$requiresTransferFlow && !$isPendingApproval && $staffRole !== 'MANAGER' && $staff->user_id !== $merchant->user_id) {
            if (empty($validated['manager_pin'])) {
                return response()->json(['message' => 'Mhudumu hana mamlaka. PIN ya Meneja inahitajika kwa punguzo au malipo ya sehemu.'], 401);
            }
            // Find any manager for this merchant to verify PIN
            $manager = \App\Models\MerchantStaff::where('merchant_id', $merchant->id)
                ->where('role', 'MANAGER')
                ->where('is_active', true)
                ->get()
                ->first(fn($m) => \Illuminate\Support\Facades\Hash::check($validated['manager_pin'], $m->pin_hash));

            if (!$manager && !\Illuminate\Support\Facades\Hash::check($validated['manager_pin'], $merchant->user->password ?? '')) {
                 return response()->json(['message' => 'PIN ya Meneja siyo sahihi.'], 401);
            }
        }

        $existingOrder = null;
        if (!empty($validated['order_id'])) {
            $existingOrder = Order::where('id', $validated['order_id'])
                ->where('merchant_id', $merchant->id)
                ->first();
            
            if ($existingOrder && $existingOrder->payment_status === 'resolved_merchant_paid') {
                return response()->json(['message' => 'Oda hii tayari imekamilika.'], 400);
            }
        }

        return DB::transaction(function () use ($merchant, $validated, $isPendingApproval, $existingOrder, $requiresTransferFlow) {
            $checkoutLocationId = (int) $validated['location_id'];
            $sourceLocationIds = collect($validated['items'])
                ->map(fn($item) => (int) ($item['source_location_id'] ?? $checkoutLocationId))
                ->push($checkoutLocationId)
                ->unique()
                ->values();

            $ownedLocationCount = MerchantLocation::where('merchant_id', $merchant->id)
                ->whereIn('id', $sourceLocationIds)
                ->count();

            if ($ownedLocationCount !== $sourceLocationIds->count()) {
                throw new \Exception('One or more selected source locations are not part of this merchant.');
            }

            // 2. Create or Update the master Order record
            $orderData = [
                'payment_mode' => $validated['payment_mode'],
                'payment_status' => ($requiresTransferFlow || $isPendingApproval || $validated['amount_paid'] < $validated['total_amount']) ? 'pending' : 'resolved_merchant_paid',
                'pos_staff_id' => $validated['staff_id'],
                'customer_name' => $validated['customer_name'] ?? ($existingOrder->customer_name ?? null),
                'customer_phone' => $validated['customer_phone'] ?? ($existingOrder->customer_phone ?? null),
                'grand_total' => $validated['total_amount'],
                'total_paid' => $validated['amount_paid'],
                'discount_amount' => $validated['discount_amount'] ?? ($existingOrder->discount_amount ?? 0),
                'approval_status' => ($requiresTransferFlow || $isPendingApproval) ? 'pending' : 'approved',
                'approval_requested_at' => ($requiresTransferFlow || $isPendingApproval) ? now() : ($existingOrder->approval_requested_at ?? null),
            ];

            if ($existingOrder) {
                $order = $existingOrder;
                $order->update($orderData);
            } else {
                $orderData = array_merge($orderData, [
                    'public_id' => Order::generatePublicId(),
                    'merchant_id' => $merchant->id,
                    'product_id' => $validated['items'][0]['product_id'],
                    'source' => 'pos',
                    'purchasable_type' => 'product',
                    'purchasable_id' => $validated['items'][0]['product_id'],
                    'order_kind' => 'one_time',
                ]);
                $order = Order::create($orderData);
            }

            // If it has a delivery (online order), mark as delivered if fully paid
            if ($order->delivery && $order->payment_status === 'resolved_merchant_paid') {
                $order->delivery->update(['delivery_status' => 'delivered']);
            }

            // Sync Merchant Customer Database
            if ($validated['customer_phone']) {
                $mc = \App\Models\MerchantCustomer::firstOrCreate(
                    ['merchant_id' => $merchant->id, 'phone' => $validated['customer_phone']],
                    ['name' => $validated['customer_name']]
                );

                $mc->increment('total_spent', $validated['total_amount']);
                $mc->increment('order_count');
                $mc->update([
                    'last_purchase_at' => now(),
                    'name' => $validated['customer_name'] ?? $mc->name // Update name if provided now
                ]);
            }

            $transferCount = 0;
            foreach ($validated['items'] as $item) {
                $sourceLocationId = (int) ($item['source_location_id'] ?? $checkoutLocationId);
                $requestedQuantity = (float) $item['quantity'];
                $integerQuantity = (int) ceil($requestedQuantity);
                $product = Product::findOrFail($item['product_id']);
                $sellableQuantity = max(0.001, (float) ($product->sellable_quantity ?: 1));

                // If source is a different location, create transfer workflow instead of immediate deduction.
                if ($sourceLocationId !== $checkoutLocationId) {
                    StockTransfer::create([
                        'merchant_id' => $merchant->id,
                        'order_id' => $order->id,
                        'product_id' => $item['product_id'],
                        'product_variant_id' => $item['variant_id'] ?? null,
                        'from_location_id' => $sourceLocationId,
                        'to_location_id' => $checkoutLocationId,
                        'quantity' => $integerQuantity,
                        'quantity_decimal' => $requestedQuantity,
                        'requested_by_staff_id' => $validated['staff_id'],
                        'status' => 'PENDING',
                        'notes' => 'Auto-created from POS checkout request for cross-location fulfillment.',
                    ]);
                    $transferCount++;
                } else {
                    // Same-location fulfillment: deduct instantly.
                    $inventory = $this->locationInventoryQuery(
                        $checkoutLocationId,
                        (int) $item['product_id'],
                        !empty($item['variant_id']) ? (int) $item['variant_id'] : null
                    )->first();

                    $availableQuantity = (float) ($inventory?->quantity_decimal ?? $inventory?->quantity ?? 0);
                    if (!$inventory || $availableQuantity < $requestedQuantity) {
                        throw new \Exception("Insufficient stock for product ID {$item['product_id']} at this location.");
                    }

                    if ($inventory->quantity_decimal !== null) {
                        $newQuantity = max(0, $availableQuantity - $requestedQuantity);
                        $inventory->update([
                            'quantity' => (int) ceil($newQuantity),
                            'quantity_decimal' => $newQuantity,
                        ]);
                    } else {
                        $inventory->decrement('quantity', $integerQuantity);
                    }

                    // Global stock reflects physically issued inventory only.
                    if (!empty($item['variant_id'])) {
                        $variant = ProductVariant::find($item['variant_id']);
                        if ($variant) {
                            $newVariantQuantity = max(0, (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0) - $requestedQuantity);
                            $variant->update([
                                'inventory_count' => (int) ceil($newVariantQuantity),
                                'inventory_quantity' => $newVariantQuantity,
                            ]);
                        }
                    }
                    $newProductQuantity = max(0, (float) ($product->inventory_quantity ?? $product->inventory_count ?? 0) - $requestedQuantity);
                    $product->update([
                        'inventory_count' => (int) ceil($newProductQuantity),
                        'inventory_quantity' => $newProductQuantity,
                    ]);
                }

                // 4. Create POS Sale Item
                PosSaleItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product_id'],
                    'product_variant_id' => $item['variant_id'] ?? null,
                    'location_id' => $checkoutLocationId,
                    'quantity' => (int) ceil((float) $item['quantity']),
                    'quantity_decimal' => (float) $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'price_at_sale' => $item['unit_price'] * ($requestedQuantity / $sellableQuantity),
                ]);
            }

            // 5. Audit Log
            $firstItem = $validated['items'][0] ?? null;
            $primaryProduct = $firstItem ? Product::find($firstItem['product_id']) : null;

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'staff_id' => $validated['staff_id'],
                'action' => 'POS_SALE',
                'description' => "POS Sale completed. Mode: {$validated['payment_mode']}. Items: " . count($validated['items']),
                'metadata' => [
                    'order_id' => $order->id, 
                    'public_id' => $order->public_id,
                    'total' => $validated['total_amount'],
                    'transfer_requests_count' => $transferCount,
                    'product_image' => $primaryProduct?->image_url,
                    'product_title' => $primaryProduct?->title,
                ]
            ]);

            return response()->json([
                'message' => $transferCount > 0
                    ? 'Sale recorded. Transfer request sent for cross-location fulfillment.'
                    : 'Sale recorded successfully.',
                'order_id' => $order->id,
                'public_id' => $order->public_id,
                'requires_transfer' => $transferCount > 0,
            ], 201);
        });
    }

    /**
     * Void a POS sale.
     */
    public function voidSale(Request $request, Order $order): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($order->merchant_id !== $merchant->id || $order->source !== 'pos') abort(403);

        $validated = $request->validate([
            'manager_staff_id' => 'required|exists:merchant_staffs,id',
            'reason' => 'required|string',
        ]);

        return DB::transaction(function () use ($order, $merchant, $validated) {
            // Restore inventory for each item
            $items = $order->posItems;
            foreach ($items as $item) {
                // Restore Location Inventory
                $inventory = $this->locationInventoryQuery(
                        (int) $item->location_id,
                        (int) $item->product_id,
                        $item->product_variant_id ? (int) $item->product_variant_id : null
                    )
                    ->first();
                $restoredQuantity = (float) ($item->quantity_decimal ?? $item->quantity);
                if ($inventory) {
                    $newQuantity = (float) ($inventory->quantity_decimal ?? $inventory->quantity ?? 0) + $restoredQuantity;
                    $inventory->update([
                        'quantity' => (int) ceil($newQuantity),
                        'quantity_decimal' => $newQuantity,
                    ]);
                }

                // Global Stock Sync (Restore)
                $restoredQuantity = (float) ($item->quantity_decimal ?? $item->quantity);
                if ($item->product_variant_id) {
                    $variant = ProductVariant::find($item->product_variant_id);
                    if ($variant) {
                        $newVariantQuantity = (float) ($variant->inventory_quantity ?? $variant->inventory_count ?? 0) + $restoredQuantity;
                        $variant->update([
                            'inventory_count' => (int) ceil($newVariantQuantity),
                            'inventory_quantity' => $newVariantQuantity,
                        ]);
                    }
                }
                $product = Product::find($item->product_id);
                if ($product) {
                    $newProductQuantity = (float) ($product->inventory_quantity ?? $product->inventory_count ?? 0) + $restoredQuantity;
                    $product->update([
                        'inventory_count' => (int) ceil($newProductQuantity),
                        'inventory_quantity' => $newProductQuantity,
                    ]);
                }
            }

            $order->update(['payment_status' => 'failed']);

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'staff_id' => $validated['manager_staff_id'],
                'action' => 'SALE_VOIDED',
                'description' => "POS Sale {$order->public_id} voided. Reason: {$validated['reason']}",
                'metadata' => ['order_id' => $order->id]
            ]);

            return response()->json(['message' => 'Sale voided and inventory restored.']);
        });
    }

    /**
     * Approve a pending POS order.
     */
    public function approveOrder(Request $request, Order $order): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($order->merchant_id !== $merchant->id) abort(403);

        $validated = $request->validate([
            'payment_mode' => 'nullable|string|in:cash,merchant_mm,online_escrow,store_credit',
            'counter_total' => 'nullable|numeric|min:0',
            'manager_notes' => 'nullable|string|max:1000',
        ]);

        $payableTotal = (float) ($validated['counter_total'] ?? $order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);
        $paidAmount = (float) ($order->total_paid ?? 0);

        $order->update([
            'approval_status' => 'approved',
            'approved_by_staff_id' => $request->user()->staffProfile($merchant->id)?->id,
            'payment_mode' => $validated['payment_mode'] ?? $order->payment_mode,
            'counter_total' => $validated['counter_total'] ?? $order->counter_total,
            'manager_notes' => $validated['manager_notes'] ?? $order->manager_notes,
            'payment_status' => $paidAmount >= $payableTotal ? 'resolved_merchant_paid' : 'pending',
        ]);

        return response()->json(['message' => 'Oda imekubaliwa kikamilifu!', 'data' => $order]);
    }

    /**
     * Get Retail Settings.
     */
    public function getSettings(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        return response()->json(['data' => $merchant->retail_settings]);
    }

    /**
     * Update Retail Settings.
     */
    public function updateSettings(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $validated = $request->validate([
            'max_no_pin_discount_percent' => 'required|integer|min:0|max:100',
            'require_pin_for_partial_payment' => 'required|boolean',
            'allow_remote_approval' => 'required|boolean',
            'allow_online_reservation' => 'required|boolean',
            'reservation_max_hours' => 'required|integer|min:1',
            'shop_routes' => 'nullable|array',
            'shop_routes.*.shop_location_id' => 'required_with:shop_routes|integer|exists:merchant_locations,id',
            'shop_routes.*.serving_store_location_id' => 'nullable|integer|exists:merchant_locations,id',
            'shop_routes.*.delivery_pickup_location_id' => 'nullable|integer|exists:merchant_locations,id',
        ]);

        $validated['shop_routes'] = collect($validated['shop_routes'] ?? [])
            ->map(function (array $route) use ($merchant) {
                return [
                    'shop_location_id' => (int) ($route['shop_location_id'] ?? 0),
                    'serving_store_location_id' => isset($route['serving_store_location_id']) && $route['serving_store_location_id'] !== ''
                        ? (int) $route['serving_store_location_id']
                        : null,
                    'delivery_pickup_location_id' => isset($route['delivery_pickup_location_id']) && $route['delivery_pickup_location_id'] !== ''
                        ? (int) $route['delivery_pickup_location_id']
                        : null,
                ];
            })
            ->filter(function (array $route) use ($merchant) {
                if ($route['shop_location_id'] <= 0) return false;

                $ids = collect([
                    $route['shop_location_id'],
                    $route['serving_store_location_id'],
                    $route['delivery_pickup_location_id'],
                ])->filter()->values();

                if ($ids->isEmpty()) return false;

                $ownedCount = MerchantLocation::where('merchant_id', $merchant->id)
                    ->whereIn('id', $ids)
                    ->count();

                return $ownedCount === $ids->count();
            })
            ->unique('shop_location_id')
            ->values()
            ->all();

        $merchant->update(['retail_settings' => $validated]);

        return response()->json(['message' => 'Retail settings updated successfully.', 'data' => $merchant->retail_settings]);
    }

    public function rejectOrder(Request $request, Order $order): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($order->merchant_id !== $merchant->id) abort(403);

        return DB::transaction(function () use ($order, $merchant) {
            $order->update(['approval_status' => 'rejected', 'payment_status' => 'failed']);
            $order->releaseInventory(); // Helper we added earlier
            return response()->json(['message' => 'Oda imekataliwa na stock imerudishwa.']);
        });
    }

    /**
     * Pending POS approvals/transfer requests visible in terminal.
     */
    public function pendingOrders(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $pendingOrders = Order::where('merchant_id', $merchant->id)
            ->whereIn('approval_status', ['pending', 'approved'])
            ->where('payment_status', 'pending')
            ->with(['product', 'posStaff.user', 'posItems.product', 'posItems.variant'])
            ->latest()
            ->get();

        $transferRows = StockTransfer::query()
            ->where('merchant_id', $merchant->id)
            ->whereIn('order_id', $pendingOrders->pluck('id')->filter()->values())
            ->with(['toLocation:id,name,type'])
            ->get(['id', 'order_id', 'status', 'to_location_id']);

        $transferByOrder = $transferRows->groupBy('order_id')->map(function ($rows) {
            $total = $rows->count();
            $received = $rows->where('status', 'RECEIVED')->count();
            $dispatched = $rows->where('status', 'DISPATCHED')->count();
            $pending = $rows->where('status', 'PENDING')->count();

            $state = 'NONE';
            if ($total > 0) {
                if ($received === $total) {
                    $state = 'RECEIVED';
                } elseif ($dispatched > 0 && $pending === 0) {
                    $state = 'DISPATCHED';
                } elseif ($pending > 0) {
                    $state = 'PENDING_DISPATCH';
                } else {
                    $state = 'IN_PROGRESS';
                }
            }

            return [
                'total' => $total,
                'received' => $received,
                'dispatched' => $dispatched,
                'pending' => $pending,
                'state' => $state,
            ];
        });

        $transferTasksByOrder = $transferRows->groupBy('order_id')->map(function ($rows) {
            return $rows->map(fn ($row) => [
                'id' => (int) $row->id,
                'status' => (string) $row->status,
                'to_location_id' => (int) $row->to_location_id,
                'to_location' => $row->toLocation ? [
                    'id' => (int) $row->toLocation->id,
                    'name' => (string) $row->toLocation->name,
                    'type' => (string) $row->toLocation->type,
                ] : null,
            ])->values();
        });

        $pendingOrders = $pendingOrders->map(function ($order) use ($transferByOrder, $transferTasksByOrder) {
            $summary = $transferByOrder->get($order->id, [
                'total' => 0,
                'received' => 0,
                'dispatched' => 0,
                'pending' => 0,
                'state' => 'NONE',
            ]);
            $order->setAttribute('transfer_summary', $summary);
            $order->setAttribute('transfer_tasks', $transferTasksByOrder->get($order->id, collect([])));
            return $order;
        });

        return response()->json(['data' => $pendingOrders]);
    }

    public function findOrderByCode(Request $request)
    {
        $merchant = $request->attributes->get('active_merchant');
        $code = strtoupper($request->code);
        
        // 1. Search by pickup_code (6 chars)
        $order = Order::with(['posItems.product', 'posItems.variant', 'product', 'variant', 'delivery'])
            ->where('pickup_code', $code)
            ->where('merchant_id', $merchant->id)
            ->first();

        // 2. Search by pickup_pin (4 digits) in deliveries
        if (!$order) {
            $order = Order::with(['posItems.product', 'posItems.variant', 'product', 'variant', 'delivery'])
                ->whereHas('delivery', function($q) use ($code) {
                    $q->where('pickup_pin', $code);
                })
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->first();
        }

        if (!$order) {
            return response()->json(['message' => 'Oda haijapatikana kwa namba hiyo.'], 404);
        }

        return response()->json(['data' => $order]);
    }
}
