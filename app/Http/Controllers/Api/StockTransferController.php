<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockTransfer;
use App\Models\ProductLocationInventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Order;
use App\Models\PosSaleItem;
use App\Models\RetailAuditLog;
use App\Models\MerchantLocation;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class StockTransferController extends Controller
{
    private function isShopLocation(?MerchantLocation $location): bool
    {
        return strtolower((string) ($location?->type ?? '')) === 'shop';
    }

    private function ensureShopLocationVerification(?\App\Models\MerchantStaff $staff, MerchantLocation $location, string $action): ?JsonResponse
    {
        if (!$this->isShopLocation($location)) {
            return null;
        }

        if (!$staff || (int) ($staff->assigned_location_id ?? 0) !== (int) $location->id) {
            $verb = $action === 'dispatch' ? 'dispatch' : 'receive';

            return response()->json([
                'message' => "Shop stock movements must be verified at {$location->name}. Please use a staff terminal assigned to that shop to {$verb} this transfer.",
            ], 403);
        }

        return null;
    }

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

    private function activeStaffContext(Request $request): ?\App\Models\MerchantStaff
    {
        $merchant = $request->attributes->get('active_merchant');
        $user = $request->user();
        if (!$merchant || !$user) return null;

        return \App\Models\MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->first();
    }

    /**
     * List transfers.
     */
    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $staff = $this->activeStaffContext($request);
        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        $dateFrom = $request->input('date_from');
        $dateTo = $request->input('date_to');
        $search = trim((string) $request->input('q', ''));
        $fromLocationId = $request->input('from_location_id');
        $toLocationId = $request->input('to_location_id');
        $staffId = $request->input('staff_id');
        
        $query = $merchant->stockTransfers()
            ->with(['product', 'variant', 'fromLocation', 'toLocation', 'requestedBy.user', 'dispatchedBy.user', 'receivedBy.user'])
            ->latest();

        if (in_array($staffRole, ['STOREKEEPER', 'CASHIER'], true)) {
            $assignedLocationId = (int) ($staff->assigned_location_id ?? 0);
            if ($assignedLocationId <= 0) {
                return response()->json(['data' => []]);
            }
            $query->where(function ($q) use ($assignedLocationId) {
                $q->where('from_location_id', $assignedLocationId)
                    ->orWhere('to_location_id', $assignedLocationId);
            });
        }

        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }
        if ($fromLocationId) {
            $query->where('from_location_id', (int) $fromLocationId);
        }
        if ($toLocationId) {
            $query->where('to_location_id', (int) $toLocationId);
        }
        if ($staffId) {
            $query->where(function ($q) use ($staffId) {
                $q->where('requested_by_staff_id', (int) $staffId)
                    ->orWhere('dispatched_by_staff_id', (int) $staffId)
                    ->orWhere('received_by_staff_id', (int) $staffId);
            });
        }
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->whereHas('product', function ($pq) use ($search) {
                    $pq->where('title', 'like', "%{$search}%");
                })->orWhereHas('variant', function ($vq) use ($search) {
                    $vq->where('name', 'like', "%{$search}%")
                        ->orWhere('sku', 'like', "%{$search}%");
                });
            });
        }

        $transfers = $query->get();
        $transfers = $transfers->map(function ($transfer) {
            $available = $this->locationInventoryQuery(
                    (int) $transfer->from_location_id,
                    (int) $transfer->product_id,
                    $transfer->product_variant_id ? (int) $transfer->product_variant_id : null
                )
                ->value('quantity');

            $transfer->setAttribute('available_source_quantity', (int) ($available ?? 0));
            return $transfer;
        });

        return response()->json(['data' => $transfers]);
    }

    public function productTimeline(Request $request, Product $product): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ((int) $product->merchant_id !== (int) $merchant->id) {
            return response()->json(['message' => 'Product does not belong to this merchant.'], 403);
        }

        $events = collect();

        $transfers = StockTransfer::query()
            ->where('merchant_id', $merchant->id)
            ->where('product_id', $product->id)
            ->with(['fromLocation:id,name', 'toLocation:id,name', 'requestedBy.user:id,name', 'dispatchedBy.user:id,name', 'receivedBy.user:id,name'])
            ->get();

        foreach ($transfers as $t) {
            $events->push([
                'type' => 'TRANSFER_REQUEST',
                'at' => optional($t->created_at)->toISOString(),
                'qty' => (int) $t->quantity,
                'from' => $t->fromLocation?->name,
                'to' => $t->toLocation?->name,
                'actor' => $t->requestedBy?->user?->name,
                'status' => $t->status,
                'note' => 'Transfer requested',
            ]);
            if ($t->dispatched_at) {
                $events->push([
                    'type' => 'TRANSFER_DISPATCHED',
                    'at' => optional($t->dispatched_at)->toISOString(),
                    'qty' => (int) $t->quantity,
                    'from' => $t->fromLocation?->name,
                    'to' => $t->toLocation?->name,
                    'actor' => $t->dispatchedBy?->user?->name,
                    'status' => $t->status,
                    'note' => 'Transfer dispatched',
                ]);
            }
            if ($t->received_at) {
                $events->push([
                    'type' => 'TRANSFER_RECEIVED',
                    'at' => optional($t->received_at)->toISOString(),
                    'qty' => (int) $t->quantity,
                    'from' => $t->fromLocation?->name,
                    'to' => $t->toLocation?->name,
                    'actor' => $t->receivedBy?->user?->name,
                    'status' => $t->status,
                    'note' => 'Transfer received',
                ]);
            }
        }

        $sales = PosSaleItem::query()
            ->where('product_id', $product->id)
            ->whereHas('order', function ($q) use ($merchant) {
                $q->where('merchant_id', $merchant->id)->where('source', 'pos');
            })
            ->with(['location:id,name', 'order:id,public_id,pos_staff_id,created_at,payment_status', 'order.posStaff.user:id,name'])
            ->get();

        foreach ($sales as $sale) {
            $events->push([
                'type' => 'POS_SALE',
                'at' => optional($sale->order?->created_at)->toISOString(),
                'qty' => (int) $sale->quantity,
                'from' => $sale->location?->name,
                'to' => 'Customer',
                'actor' => $sale->order?->posStaff?->user?->name,
                'status' => $sale->order?->payment_status,
                'note' => 'Sold via POS',
            ]);
        }

        $restockLogs = RetailAuditLog::query()
            ->where('merchant_id', $merchant->id)
            ->where('action', 'RESTOCK')
            ->where('description', 'like', "%product #{$product->id}%")
            ->with(['user:id,name', 'staff.user:id,name'])
            ->get();

        foreach ($restockLogs as $log) {
            $events->push([
                'type' => 'RESTOCK',
                'at' => optional($log->created_at)->toISOString(),
                'qty' => null,
                'from' => null,
                'to' => null,
                'actor' => $log->staff?->user?->name ?? $log->user?->name,
                'status' => null,
                'note' => $log->description,
            ]);
        }

        $events = $events->filter(fn ($row) => !empty($row['at']))->sortByDesc('at')->values();

        $locations = MerchantLocation::query()
            ->where('merchant_id', $merchant->id)
            ->get(['id', 'name', 'type']);

        $flags = collect();
        $now = now();

        $staleDispatched = $transfers->filter(function ($t) use ($now) {
            return $t->status === 'DISPATCHED'
                && $t->dispatched_at
                && $t->dispatched_at->diffInHours($now) >= 24;
        });
        if ($staleDispatched->count() > 0) {
            $flags->push([
                'severity' => 'high',
                'code' => 'STALE_DISPATCH',
                'title' => 'Dispatched but not received (24h+)',
                'count' => $staleDispatched->count(),
                'detail' => 'Some dispatched transfers have not been confirmed at destination for over 24 hours.',
            ]);
        }

        $cancelled = $transfers->where('status', 'CANCELLED')->count();
        if ($cancelled > 0) {
            $flags->push([
                'severity' => 'medium',
                'code' => 'CANCELLED_TRANSFERS',
                'title' => 'Cancelled transfers detected',
                'count' => $cancelled,
                'detail' => 'Cancelled transfer attempts exist for this product. Review reasons and approvals.',
            ]);
        }

        $recentRestockLogs = $restockLogs->filter(fn ($log) => optional($log->created_at)?->gte(now()->subDays(7)));
        if ($recentRestockLogs->count() >= 5) {
            $flags->push([
                'severity' => 'medium',
                'code' => 'FREQUENT_ADJUSTMENTS',
                'title' => 'Frequent stock adjustments',
                'count' => $recentRestockLogs->count(),
                'detail' => 'High number of restock/adjustment actions in the last 7 days. Reconcile physical counts.',
            ]);
        }

        return response()->json([
            'data' => [
                'product' => [
                    'id' => $product->id,
                    'title' => $product->title,
                    'image_url' => $product->image_url,
                ],
                'events' => $events,
                'locations' => $locations,
                'flags' => $flags->values(),
            ],
        ]);
    }

    /**
     * Create a transfer request (PENDING).
     */
    public function store(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $staff = $this->activeStaffContext($request);
        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        if ($staffRole === 'STOREKEEPER') {
            return response()->json(['message' => 'Storekeeper cannot create transfer requests.'], 403);
        }

        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'product_variant_id' => 'nullable|exists:product_variants,id',
            'from_location_id' => 'required|exists:merchant_locations,id',
            'to_location_id' => 'required|exists:merchant_locations,id|different:from_location_id',
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string',
            'staff_id' => 'nullable|exists:merchant_staffs,id',
        ]);

        $ownsProduct = Product::where('merchant_id', $merchant->id)
            ->where('id', $validated['product_id'])
            ->exists();
        if (!$ownsProduct) {
            return response()->json(['message' => 'Product does not belong to this merchant.'], 422);
        }

        $hasVariants = Product::where('merchant_id', $merchant->id)
            ->where('id', $validated['product_id'])
            ->where('has_variants', true)
            ->exists();
        if ($hasVariants && empty($validated['product_variant_id'])) {
            return response()->json(['message' => 'Please select a specific variant for this product.'], 422);
        }

        if (!empty($validated['product_variant_id'])) {
            $ownsVariant = ProductVariant::where('id', $validated['product_variant_id'])
                ->where('product_id', $validated['product_id'])
                ->whereHas('product', function ($q) use ($merchant) {
                    $q->where('merchant_id', $merchant->id);
                })
                ->exists();
            if (!$ownsVariant) {
                return response()->json(['message' => 'Variant does not match selected product.'], 422);
            }
        }

        $validLocationCount = \App\Models\MerchantLocation::where('merchant_id', $merchant->id)
            ->whereIn('id', [(int) $validated['from_location_id'], (int) $validated['to_location_id']])
            ->count();
        if ($validLocationCount !== 2) {
            return response()->json(['message' => 'Source/Destination location does not belong to this merchant.'], 422);
        }

        $transfer = StockTransfer::create([
            'merchant_id' => $merchant->id,
            'product_id' => $validated['product_id'],
            'product_variant_id' => $validated['product_variant_id'] ?? null,
            'from_location_id' => $validated['from_location_id'],
            'to_location_id' => $validated['to_location_id'],
            'quantity' => $validated['quantity'],
            'requested_by_staff_id' => $validated['staff_id'] ?? $staff?->id,
            'status' => 'PENDING',
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Stock transfer request created.',
            'data' => $transfer->load(['product', 'fromLocation', 'toLocation'])
        ], 201);
    }

    /**
     * Dispatch items (Handshake Step 1).
     */
    public function dispatch(Request $request, StockTransfer $transfer): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($transfer->merchant_id !== $merchant->id) abort(403);
        $transfer->loadMissing(['fromLocation', 'toLocation']);
        $staff = $this->activeStaffContext($request);
        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        if (in_array($staffRole, ['STOREKEEPER', 'CASHIER'], true) && (int) ($staff->assigned_location_id ?? 0) !== (int) $transfer->from_location_id) {
            return response()->json(['message' => 'Staff can dispatch only from their assigned source location.'], 403);
        }
        if ($response = $this->ensureShopLocationVerification($staff, $transfer->fromLocation, 'dispatch')) {
            return $response;
        }
        if ($staffRole === 'CASHIER' && !$this->isShopLocation($transfer->fromLocation)) {
            return response()->json(['message' => 'Cashiers can only verify transfers from their assigned shop.'], 403);
        }

        if ($transfer->status !== 'PENDING') {
            return response()->json(['message' => 'Transfer cannot be dispatched in current status.'], 422);
        }

        $validated = $request->validate([
            'staff_id' => 'nullable|exists:merchant_staffs,id',
        ]);
        $actingStaffId = $validated['staff_id'] ?? $staff?->id;
        if (!$actingStaffId) {
            return response()->json(['message' => 'Staff context missing. Please log in again.'], 401);
        }

        return DB::transaction(function () use ($transfer, $actingStaffId) {
            // Check if from_location has enough stock
            $inventory = $this->locationInventoryQuery(
                    (int) $transfer->from_location_id,
                    (int) $transfer->product_id,
                    $transfer->product_variant_id ? (int) $transfer->product_variant_id : null
                )
                ->first();

            if (!$inventory || $inventory->quantity < $transfer->quantity) {
                return response()->json(['message' => 'Insufficient stock at the source location.'], 422);
            }

            // Deduct from source
            $inventory->decrement('quantity', $transfer->quantity);

            $transfer->update([
                'status' => 'DISPATCHED',
                'dispatched_by_staff_id' => $actingStaffId,
                'dispatched_at' => now(),
            ]);

            return response()->json([
                'message' => 'Items dispatched. Stock deducted from source.',
                'data' => $transfer
            ]);
        });
    }

    /**
     * Receive items (Handshake Step 2).
     */
    public function receive(Request $request, StockTransfer $transfer): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($transfer->merchant_id !== $merchant->id) abort(403);
        $transfer->loadMissing(['fromLocation', 'toLocation']);
        $staff = $this->activeStaffContext($request);
        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        if (in_array($staffRole, ['STOREKEEPER', 'CASHIER'], true) && (int) ($staff->assigned_location_id ?? 0) !== (int) $transfer->to_location_id) {
            return response()->json(['message' => 'Staff can confirm receipt only at their assigned destination location.'], 403);
        }
        if ($response = $this->ensureShopLocationVerification($staff, $transfer->toLocation, 'receive')) {
            return $response;
        }
        if ($staffRole === 'CASHIER' && !$this->isShopLocation($transfer->toLocation)) {
            return response()->json(['message' => 'Cashiers can only verify transfers to their assigned shop.'], 403);
        }

        if ($transfer->status !== 'DISPATCHED') {
            return response()->json(['message' => 'Transfer cannot be received in current status.'], 422);
        }

        $validated = $request->validate([
            'staff_id' => 'nullable|exists:merchant_staffs,id',
        ]);
        $actingStaffId = $validated['staff_id'] ?? $staff?->id;
        if (!$actingStaffId) {
            return response()->json(['message' => 'Staff context missing. Please log in again.'], 401);
        }

        return DB::transaction(function () use ($transfer, $actingStaffId) {
            // Add to destination
            $inventory = $this->locationInventoryQuery(
                    (int) $transfer->to_location_id,
                    (int) $transfer->product_id,
                    $transfer->product_variant_id ? (int) $transfer->product_variant_id : null
                )
                ->first();

            if (!$inventory) {
                $inventory = ProductLocationInventory::create([
                    'merchant_location_id' => $transfer->to_location_id,
                    'product_id' => $transfer->product_id,
                    'product_variant_id' => $transfer->product_variant_id,
                    'quantity' => 0,
                ]);
            }

            $inventory->increment('quantity', $transfer->quantity);

            $transfer->update([
                'status' => 'RECEIVED',
                'received_by_staff_id' => $actingStaffId,
                'received_at' => now(),
            ]);

            // If this transfer belongs to a POS order, auto-approve once all transfers are received.
            if ($transfer->order_id) {
                $remaining = StockTransfer::where('order_id', $transfer->order_id)
                    ->where('status', '!=', 'RECEIVED')
                    ->count();

                if ($remaining === 0) {
                    Order::where('id', $transfer->order_id)
                        ->where('approval_status', 'pending')
                        ->update([
                            'approval_status' => 'approved',
                            'approved_by_staff_id' => $actingStaffId,
                        ]);
                }
            }

            return response()->json([
                'message' => 'Items received. Stock added to destination.',
                'data' => $transfer
            ]);
        });
    }

    /**
     * Cancel a transfer request.
     */
    public function cancel(Request $request, StockTransfer $transfer): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ($transfer->merchant_id !== $merchant->id) abort(403);
        $staff = $this->activeStaffContext($request);
        $staffRole = strtoupper((string) ($staff?->role ?? ''));
        if ($staffRole === 'STOREKEEPER') {
            return response()->json(['message' => 'Storekeeper cannot cancel transfer requests.'], 403);
        }

        if ($transfer->status !== 'PENDING') {
            return response()->json(['message' => 'Only pending transfers can be cancelled.'], 422);
        }

        $transfer->update(['status' => 'CANCELLED']);

        return response()->json(['message' => 'Transfer request cancelled.']);
    }
}
