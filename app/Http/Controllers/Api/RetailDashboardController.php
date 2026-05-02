<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use App\Models\MerchantStrike;
use App\Models\MerchantTrustSafetyReview;
use App\Models\Order;
use App\Models\ProductLocationInventory;
use App\Models\RetailAuditLog;
use App\Models\StockTransfer;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class RetailDashboardController extends Controller
{
    private function outstandingBalance(Order $order): float
    {
        $payableTotal = (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);
        $paidAmount = (float) ($order->total_paid ?? 0);

        return max($payableTotal - $paidAmount, 0);
    }

    private function posPaymentLinksDisabled($merchant): bool
    {
        return filter_var($merchant->retail_settings['disable_pos_payment_links'] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Owner dashboard metrics.
     */
    public function index(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $user = $request->user();

        // 0. Permission Check: Only Owners or MANAGERS can see dashboard metrics
        $isOwner = $merchant->user_id === $user->id;
        $isManager = \App\Models\MerchantStaff::where('merchant_id', $merchant->id)
            ->where('user_id', $user->id)
            ->where('role', 'MANAGER')
            ->where('is_active', true)
            ->exists();

        if (!$isOwner && !$isManager) {
            return response()->json([
                'message' => 'Huna ruhusa ya kuona ripoti za biashara. Sehemu hii ni kwa ajili ya Mameneja tu.',
            ], 403);
        }
        
        // 1. Ledger Metrics
        $takeerBalance = Order::where('merchant_id', $merchant->id)
            ->where('payment_mode', 'online_escrow')
            ->whereIn('payment_status', ['escrow_locked', 'resolved_merchant_paid'])
            ->sum('total_paid');

        $inHandRevenue = Order::where('merchant_id', $merchant->id)
            ->whereIn('payment_mode', ['cash', 'merchant_mm'])
            ->where('payment_status', 'resolved_merchant_paid')
            ->whereDate('created_at', now()->today())
            ->sum('total_paid');

        $outstandingCredit = Order::where('merchant_id', $merchant->id)
            ->where('source', 'pos')
            ->where(function ($q) {
                $q->whereNull('approval_status')
                    ->orWhere('approval_status', 'approved');
            })
            ->whereNotIn('payment_status', ['failed', 'resolved_buyer_refunded'])
            ->get(['counter_total', 'grand_total', 'total_paid'])
            ->sum(fn(Order $order) => $this->outstandingBalance($order));

        // 2. Low Stock Alerts
        $lowStockRows = ProductLocationInventory::whereHas('location', function($q) use ($merchant) {
                $q->where('merchant_id', $merchant->id);
            })
            ->where('quantity', '<=', 5)
            ->with([
                'product:id,title',
                'product.images:id,product_id,image_url,order',
                'location:id,name',
                'variant:id,name,sku,product_id,attributes',
            ])
            ->get();

        $lowStock = $lowStockRows->map(function (ProductLocationInventory $row) {
            $productTitle = trim((string) ($row->product?->title ?? ''));
            $variantName = trim((string) ($row->variant?->name ?? ''));
            $variantSku = trim((string) ($row->variant?->sku ?? ''));
            $fallbackTitle = $variantName !== '' ? $variantName : ($variantSku !== '' ? "SKU: {$variantSku}" : "Product #{$row->product_id}");

            return [
                'id' => $row->id,
                'product_id' => $row->product_id,
                'product_variant_id' => $row->product_variant_id,
                'merchant_location_id' => $row->merchant_location_id,
                'quantity' => (int) $row->quantity,
                'location' => [
                    'id' => $row->location?->id,
                    'name' => $row->location?->name,
                ],
                'product' => [
                    'id' => $row->product?->id,
                    'title' => $productTitle !== '' ? $productTitle : $fallbackTitle,
                    'image_url' => $row->product?->images?->first()?->image_url,
                ],
                'variant' => $row->variant ? [
                    'id' => $row->variant->id,
                    'name' => $row->variant->name,
                    'sku' => $row->variant->sku,
                    'attributes' => $row->variant->attributes ?? [],
                ] : null,
            ];
        })->values();

        // 3. Location Breakdown
        $locationRevenue = Order::where('merchant_id', $merchant->id)
            ->where('source', 'pos')
            ->where('payment_status', 'resolved_merchant_paid')
            ->join('pos_sale_items', 'orders.id', '=', 'pos_sale_items.order_id')
            ->selectRaw('location_id, sum(price_at_sale) as total')
            ->groupBy('location_id')
            ->with('posItems.location') // Simplification for demo
            ->get();

        $pendingOrders = Order::where('merchant_id', $merchant->id)
            ->whereIn('approval_status', ['pending', 'approved'])
            ->where('payment_status', 'pending')
            ->with(['product', 'posStaff.user', 'posItems.product', 'posItems.variant'])
            ->latest()
            ->get();

        $transferRows = StockTransfer::query()
            ->where('merchant_id', $merchant->id)
            ->whereIn('order_id', $pendingOrders->pluck('id')->filter()->values())
            ->get(['order_id', 'status']);

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

        $pendingOrders = $pendingOrders->map(function ($order) use ($transferByOrder) {
            $summary = $transferByOrder->get($order->id, [
                'total' => 0,
                'received' => 0,
                'dispatched' => 0,
                'pending' => 0,
                'state' => 'NONE',
            ]);
            $order->setAttribute('transfer_summary', $summary);
            return $order;
        });

        return response()->json([
            'metrics' => [
                'takeer_balance' => (float) $takeerBalance,
                'today_in_hand' => (float) $inHandRevenue,
                'outstanding_credit' => (float) $outstandingCredit,
            ],
            'pending_approvals' => $pendingOrders,
            'low_stock' => $lowStock,
            'recent_activity' => RetailAuditLog::where('merchant_id', $merchant->id)
                ->with('staff.user')
                ->latest()
                ->limit(10)
                ->get()
        ]);
    }

    /**
     * Paginated audit logs.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        
        $logs = RetailAuditLog::where('merchant_id', $merchant->id)
            ->with(['staff.user', 'user'])
            ->latest()
            ->paginate(30);

        return response()->json($logs);
    }

    public function trustSafety(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $strikes = MerchantStrike::query()
            ->where('merchant_id', $merchant->id)
            ->latest()
            ->get()
            ->map(fn(MerchantStrike $strike) => [
                'id' => $strike->id,
                'type' => $strike->type,
                'severity' => $strike->severity,
                'notes' => $strike->notes,
                'created_at' => $strike->created_at?->toISOString(),
            ])
            ->values();

        $posReports = Dispute::query()
            ->where('buyer_unboxing_video_url', 'pos-credit-link-report')
            ->whereHas('order', fn($q) => $q->where('merchant_id', $merchant->id))
            ->with('order:id,public_id,merchant_id,customer_name,customer_phone,created_at')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn(Dispute $dispute) => [
                'id' => $dispute->id,
                'status' => $dispute->status,
                'reason' => $this->merchantSafeDisputeReason($dispute->dispute_reason),
                'admin_notes' => $dispute->admin_resolution_notes,
                'created_at' => $dispute->created_at?->toISOString(),
                'order' => $dispute->order ? [
                    'id' => $dispute->order->id,
                    'public_id' => $dispute->order->public_id,
                    'payment_url' => route('retail-credit-payment.show', ['publicId' => $dispute->order->public_id]),
                    'customer_name' => $dispute->order->customer_name,
                    'customer_phone' => $dispute->order->customer_phone,
                    'created_at' => $dispute->order->created_at?->toISOString(),
                ] : null,
            ])
            ->values();

        $linksDisabled = $this->posPaymentLinksDisabled($merchant);
        $openReports = $posReports->where('status', 'open')->count();
        $pendingReviews = MerchantTrustSafetyReview::where('merchant_id', $merchant->id)->where('status', 'pending')->count();

        return response()->json([
            'status' => [
                'standing' => $linksDisabled || $openReports > 0 || $pendingReviews > 0 ? 'attention_needed' : 'good',
                'pos_payment_links_disabled' => $linksDisabled,
                'strike_count' => $strikes->count(),
                'open_pos_reports' => $openReports,
                'total_pos_reports' => $posReports->count(),
                'pending_review_count' => $pendingReviews,
            ],
            'strikes' => $strikes,
            'pos_reports' => $posReports,
            'reviews' => MerchantTrustSafetyReview::where('merchant_id', $merchant->id)
                ->latest()
                ->limit(10)
                ->get()
                ->map(fn(MerchantTrustSafetyReview $review) => [
                    'id' => $review->id,
                    'status' => $review->status,
                    'merchant_message' => $review->merchant_message,
                    'admin_notes' => $review->admin_notes,
                    'action_taken' => $review->action_taken,
                    'created_at' => $review->created_at?->toISOString(),
                    'reviewed_at' => $review->reviewed_at?->toISOString(),
                ]),
        ]);
    }

    public function requestTrustSafetyReview(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');

        $validated = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $review = MerchantTrustSafetyReview::create([
            'merchant_id' => $merchant->id,
            'requested_by_user_id' => $request->user()?->id,
            'status' => 'pending',
            'merchant_message' => $validated['message'],
        ]);

        RetailAuditLog::create([
            'merchant_id' => $merchant->id,
            'staff_id' => $request->attributes->get('active_staff')?->id,
            'user_id' => $request->user()?->id,
            'action' => 'MERCHANT_TRUST_SAFETY_REVIEW_REQUESTED',
            'description' => 'Merchant requested review of Trust & Safety status.',
            'metadata' => [
                'review_id' => $review->id,
                'message' => $validated['message'],
                'pos_payment_links_disabled' => $this->posPaymentLinksDisabled($merchant),
            ],
        ]);

        return response()->json([
            'message' => 'Tumepokea ombi lako. Timu ya Takeer italipitia na kukujulisha.',
        ]);
    }

    private function merchantSafeDisputeReason(?string $reason): string
    {
        if (!$reason) {
            return 'Customer reported this POS payment request.';
        }

        return trim(explode("\n", $reason)[0]);
    }

    public function outstandingBalances(Request $request): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        $query = trim((string) $request->input('q', ''));

        $ordersQuery = Order::where('merchant_id', $merchant->id)
            ->where('source', 'pos')
            ->where(function ($q) {
                $q->whereNull('approval_status')
                    ->orWhere('approval_status', 'approved');
            })
            ->whereNotIn('payment_status', ['failed', 'resolved_buyer_refunded'])
            ->with(['posStaff.user', 'posItems.product', 'posItems.variant'])
            ->latest();

        if ($query !== '') {
            $ordersQuery->where(function ($q) use ($query) {
                $q->where('public_id', 'LIKE', "%{$query}%")
                    ->orWhere('customer_name', 'LIKE', "%{$query}%")
                    ->orWhere('customer_phone', 'LIKE', "%{$query}%");
            });
        }

        $rawOrders = $ordersQuery->get();
        $orderIds = $rawOrders->pluck('id')->values();

        $paymentsByOrder = RetailAuditLog::where('merchant_id', $merchant->id)
            ->where('action', 'OUTSTANDING_BALANCE_PAYMENT')
            ->with(['staff.user', 'user'])
            ->latest()
            ->get()
            ->filter(fn(RetailAuditLog $log) => $orderIds->contains((int) data_get($log->metadata, 'order_id')))
            ->groupBy(fn(RetailAuditLog $log) => (int) data_get($log->metadata, 'order_id'));

        $orders = $rawOrders
            ->map(function (Order $order) use ($paymentsByOrder) {
                $outstanding = $this->outstandingBalance($order);
                if ($outstanding <= 0) {
                    return null;
                }

                $paymentHistory = $paymentsByOrder
                    ->get($order->id, collect())
                    ->map(fn(RetailAuditLog $log) => [
                        'id' => $log->id,
                        'amount' => (float) data_get($log->metadata, 'amount', 0),
                        'remaining_balance' => (float) data_get($log->metadata, 'remaining_balance', 0),
                        'note' => data_get($log->metadata, 'note'),
                        'recorded_by' => $log->staff?->user?->name ?? $log->user?->name,
                        'recorded_at' => $log->created_at?->toISOString(),
                    ])
                    ->values();

                return [
                    'id' => $order->id,
                    'public_id' => $order->public_id,
                    'customer_name' => $order->customer_name,
                    'customer_phone' => $order->customer_phone,
                    'payment_status' => $order->payment_status,
                    'payment_mode' => $order->payment_mode,
                    'grand_total' => (float) ($order->grand_total ?? $order->total_paid ?? 0),
                    'counter_total' => $order->counter_total !== null ? (float) $order->counter_total : null,
                    'payable_total' => (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0),
                    'total_paid' => (float) ($order->total_paid ?? 0),
                    'outstanding_balance' => $outstanding,
                    'created_at' => $order->created_at?->toISOString(),
                    'payment_history' => $paymentHistory,
                    'pos_staff' => $order->posStaff ? [
                        'id' => $order->posStaff->id,
                        'name' => $order->posStaff->user?->name,
                    ] : null,
                    'items' => $order->posItems->map(fn($item) => [
                        'id' => $item->id,
                        'product_title' => $item->product?->title ?? 'Unknown Product',
                        'variant_name' => $item->variant?->name,
                        'quantity' => (int) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'line_total' => (float) $item->price_at_sale,
                    ])->values(),
                ];
            })
            ->filter()
            ->values();

        return response()->json([
            'data' => $orders,
            'summary' => [
                'count' => $orders->count(),
                'outstanding_credit' => (float) $orders->sum('outstanding_balance'),
                'pos_payment_links_disabled' => $this->posPaymentLinksDisabled($merchant),
            ],
        ]);
    }

    public function settleOutstanding(Request $request, Order $order): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ((int) $order->merchant_id !== (int) $merchant->id) {
            abort(403);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:1000',
        ]);

        return DB::transaction(function () use ($request, $merchant, $order, $validated) {
            $order->refresh();
            $outstanding = $this->outstandingBalance($order);
            $amount = round((float) $validated['amount'], 2);

            if ($outstanding <= 0) {
                return response()->json(['message' => 'Deni la oda hii tayari limelipwa.'], 422);
            }

            if ($amount > $outstanding) {
                return response()->json([
                    'message' => 'Kiasi cha malipo hakiwezi kuzidi salio lililobaki.',
                ], 422);
            }

            $newPaid = round(((float) ($order->total_paid ?? 0)) + $amount, 2);
            $payableTotal = (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);
            $isSettled = $newPaid >= $payableTotal;

            $order->update([
                'total_paid' => $newPaid,
                'payment_status' => $isSettled ? 'resolved_merchant_paid' : 'pending',
            ]);

            RetailAuditLog::create([
                'merchant_id' => $merchant->id,
                'staff_id' => $request->attributes->get('active_staff')?->id,
                'user_id' => $request->user()?->id,
                'action' => 'OUTSTANDING_BALANCE_PAYMENT',
                'description' => "Payment collected for POS {$order->public_id}.",
                'metadata' => [
                    'order_id' => $order->id,
                    'public_id' => $order->public_id,
                    'amount' => $amount,
                    'remaining_balance' => max($payableTotal - $newPaid, 0),
                    'note' => $validated['note'] ?? null,
                ],
            ]);

            return response()->json([
                'message' => $isSettled ? 'Deni limelipwa kikamilifu.' : 'Malipo yamehifadhiwa.',
                'data' => [
                    'order_id' => $order->id,
                    'total_paid' => $newPaid,
                    'outstanding_balance' => max($payableTotal - $newPaid, 0),
                    'payment_status' => $order->fresh()->payment_status,
                ],
            ]);
        });
    }

    public function outstandingPaymentLink(Request $request, Order $order): JsonResponse
    {
        $merchant = $request->attributes->get('active_merchant');
        if ((int) $order->merchant_id !== (int) $merchant->id || $order->source !== 'pos') {
            abort(403);
        }

        if ($this->posPaymentLinksDisabled($merchant)) {
            return response()->json([
                'message' => 'Payment links for POS outstanding balances are disabled for this merchant.',
            ], 403);
        }

        $outstanding = $this->outstandingBalance($order);
        if ($outstanding <= 0) {
            return response()->json(['message' => 'Deni hili tayari limelipwa.'], 422);
        }

        return response()->json([
            'url' => route('retail-credit-payment.show', ['publicId' => $order->public_id]),
            'outstanding_balance' => $outstanding,
        ]);
    }
}
