<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use App\Models\Order;
use App\Models\RetailAuditLog;
use App\Models\User;
use App\Models\Wallet;
use App\Payments\PaymentCallbackProcessor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class RetailCreditPaymentController extends Controller
{
    public function __construct(
        private readonly PaymentCallbackProcessor $paymentCallbackProcessor,
    ) {}

    public function show(string $publicId): Response
    {
        $order = $this->findCreditOrder($publicId);
        $merchant = $order->merchant?->loadMissing(['currency', 'storefrontSetting']);

        return Inertia::render('Public/RetailCreditPayment', [
            'order' => $this->serializeCreditOrder($order),
            'merchant' => $merchant,
            'paymentLinksDisabled' => $this->posPaymentLinksDisabled($merchant),
        ]);
    }

    public function pay(Request $request, string $publicId): JsonResponse
    {
        $order = $this->findCreditOrder($publicId);
        $outstanding = $this->outstandingBalance($order);

        if ($this->posPaymentLinksDisabled($order->merchant)) {
            return response()->json([
                'message' => 'Kiungo hiki kimezimwa kwa muda. Tafadhali wasiliana na Takeer au duka husika.',
            ], 403);
        }

        if ($outstanding <= 0) {
            return response()->json(['message' => 'Deni hili tayari limelipwa.'], 422);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:100',
            'payment_number' => 'required|string|max:32',
            'buyer_name' => 'nullable|string|max:255',
            'received_confirmation' => 'accepted',
        ]);

        $amount = round((float) $validated['amount'], 2);
        if ($amount > $outstanding) {
            return response()->json([
                'message' => 'Kiasi cha malipo hakiwezi kuzidi salio lililobaki.',
            ], 422);
        }

        $paymentOrder = DB::transaction(function () use ($order, $validated, $amount) {
            $buyerName = trim((string) ($validated['buyer_name'] ?? '')) ?: ($order->customer_name ?: 'Credit Customer');
            $accountPhone = $order->customer_phone ?: $validated['payment_number'];

            $buyer = User::firstOrCreate(
                ['phone_number' => $accountPhone],
                ['name' => $buyerName, 'role' => 'buyer']
            );

            if (!$buyer->name && $buyerName) {
                $buyer->update(['name' => $buyerName]);
            }

            if (!$buyer->wallet) {
                Wallet::create(['user_id' => $buyer->id, 'balance' => 0, 'frozen_balance' => 0]);
            }

            $firstItem = $order->posItems()->first();
            $transactionRef = 'CRD-' . Str::upper(Str::random(10));

            return Order::create([
                'buyer_id' => $buyer->id,
                'merchant_id' => $order->merchant_id,
                'product_id' => $firstItem?->product_id ?? $order->product_id,
                'variant_id' => $firstItem?->product_variant_id ?? $order->variant_id,
                'purchasable_type' => 'product',
                'purchasable_id' => $firstItem?->product_id ?? $order->product_id,
                'order_kind' => 'one_time',
                'quantity' => 1,
                'unit_price' => $amount,
                'total_paid' => $amount,
                'grand_total' => $amount,
                'payment_status' => 'pending',
                'source' => 'pos',
                'payment_mode' => 'online_escrow',
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'idempotency_key' => (string) Str::uuid(),
                'transaction_ref' => $transactionRef,
                'account_phone' => $accountPhone,
                'payment_phone' => $validated['payment_number'],
                'payment_gateway' => 'simulated',
                'country_code' => 'TZ',
                'extra_items' => [
                    'credit_order_id' => $order->id,
                    'credit_order_public_id' => $order->public_id,
                    'credit_payment_amount' => $amount,
                ],
                'expires_at' => now()->addMinutes(30),
            ]);
        });

        $this->paymentCallbackProcessor->handleSuccess(
            order: $paymentOrder,
            gatewayRef: 'SIM-' . $paymentOrder->transaction_ref,
            gateway: 'simulated',
        );

        return response()->json([
            'message' => 'Malipo ya majaribio yamefanikiwa. Salio limesasishwa.',
            'payment_order_id' => $paymentOrder->id,
            'transaction_ref' => $paymentOrder->transaction_ref,
        ], 201);
    }

    public function report(Request $request, string $publicId): JsonResponse
    {
        $order = $this->findCreditOrder($publicId);

        $validated = $request->validate([
            'reporter_name' => 'nullable|string|max:255',
            'reporter_phone' => 'nullable|string|max:32',
            'reason' => 'required|string|in:not_received,unknown_request,wrong_amount,other',
            'notes' => 'nullable|string|max:1000',
        ]);

        DB::transaction(function () use ($order, $validated) {
            Dispute::updateOrCreate(
                ['order_id' => $order->id],
                [
                    'buyer_unboxing_video_url' => 'pos-credit-link-report',
                    'dispute_reason' => $this->formatReportReason($validated),
                    'status' => 'open',
                ]
            );

            RetailAuditLog::create([
                'merchant_id' => $order->merchant_id,
                'staff_id' => null,
                'user_id' => null,
                'action' => 'OUTSTANDING_BALANCE_PAYMENT_LINK_REPORTED',
                'description' => "Customer reported POS payment link {$order->public_id}.",
                'metadata' => [
                    'order_id' => $order->id,
                    'public_id' => $order->public_id,
                    'reporter_name' => $validated['reporter_name'] ?? null,
                    'reporter_phone' => $validated['reporter_phone'] ?? null,
                    'reason' => $validated['reason'],
                    'notes' => $validated['notes'] ?? null,
                ],
            ]);
        });

        return response()->json([
            'message' => 'Taarifa imepokelewa. Usilipe kama huna uhakika kwamba ulipokea bidhaa hizi.',
        ]);
    }

    private function formatReportReason(array $validated): string
    {
        $reason = match ($validated['reason']) {
            'not_received' => 'Customer says they did not receive these POS items.',
            'unknown_request' => 'Customer says they do not recognize this payment request.',
            'wrong_amount' => 'Customer says the requested amount is wrong.',
            default => 'Customer reported this POS payment request.',
        };

        $details = [];
        if (!empty($validated['reporter_name'])) {
            $details[] = "Name: {$validated['reporter_name']}";
        }
        if (!empty($validated['reporter_phone'])) {
            $details[] = "Phone: {$validated['reporter_phone']}";
        }
        if (!empty($validated['notes'])) {
            $details[] = "Notes: {$validated['notes']}";
        }

        return trim($reason . (count($details) ? "\n" . implode("\n", $details) : ''));
    }

    private function findCreditOrder(string $publicId): Order
    {
        return Order::query()
            ->where('public_id', $publicId)
            ->where('source', 'pos')
            ->where(function ($q) {
                $q->whereNull('approval_status')
                    ->orWhere('approval_status', 'approved');
            })
            ->whereNotIn('payment_status', ['failed', 'resolved_buyer_refunded'])
            ->with(['merchant.currency', 'merchant.storefrontSetting', 'posStaff.user', 'posItems.product', 'posItems.variant'])
            ->firstOrFail();
    }

    private function outstandingBalance(Order $order): float
    {
        $payableTotal = (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);
        $paidAmount = (float) ($order->total_paid ?? 0);

        return max($payableTotal - $paidAmount, 0);
    }

    private function posPaymentLinksDisabled($merchant): bool
    {
        return filter_var($merchant?->retail_settings['disable_pos_payment_links'] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    private function serializeCreditOrder(Order $order): array
    {
        $payableTotal = (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);

        return [
            'id' => $order->id,
            'public_id' => $order->public_id,
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'payable_total' => $payableTotal,
            'total_paid' => (float) ($order->total_paid ?? 0),
            'outstanding_balance' => $this->outstandingBalance($order),
            'created_at' => $order->created_at?->toISOString(),
            'pos_staff' => $order->posStaff?->user?->name,
            'items' => $order->posItems->map(fn($item) => [
                'id' => $item->id,
                'product_title' => $item->product?->title ?? 'Unknown Product',
                'variant_name' => $item->variant?->name,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'line_total' => (float) $item->price_at_sale,
            ])->values(),
        ];
    }
}
