<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\Transaction;
use App\Models\WithdrawalRequest;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Inertia\Inertia;
use App\Models\Merchant;

class MerchantWalletController extends Controller
{
    /**
     * Display the merchant wallet dashboard.
     */
    public function show(Request $request, Merchant $merchant)
    {
        return $this->renderWallet($request, $merchant, false);
    }

    public function showLedger(Request $request, Merchant $merchant)
    {
        return $this->renderWallet($request, $merchant, true);
    }

    private function renderWallet(Request $request, Merchant $merchant, bool $ledgerMode)
    {
        $user = $request->user();
        
        // Merchant wallets are scoped per profile for ledger and audit separation.
        $wallet = $merchant->wallet()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]
        );
        $retailEligible = $merchant->isRetailEligible();
        $initialLedgerType = $this->normalizeLedgerType($request->query('type'));
        if (! $retailEligible && in_array($initialLedgerType, ['non-escrow', 'credit'], true)) {
            $initialLedgerType = null;
        }

        return Inertia::render('Merchant/Wallet', [
            'merchant' => $merchant,
            'merchantUsername' => $merchant->username,
            'merchantName' => $merchant->display_name,
            'wallet' => [
                'balance' => (float) $wallet->balance,
                'frozen_balance' => (float) $wallet->frozen_balance,
            ],
            'retailEligible' => $retailEligible,
            'initialLedgerType' => $initialLedgerType,
            'ledgerMode' => $ledgerMode,
        ]);
    }

    /**
     * Get recent transactions and withdrawals (API).
     */
    public function history(Request $request, Merchant $merchant)
    {
        $user = $request->user();
        $type = $this->normalizeLedgerType($request->query('type'));
        if (! $merchant->isRetailEligible() && in_array($type, ['non-escrow', 'credit'], true)) {
            $type = null;
        }

        $perPage = min(max((int) $request->integer('per_page', 20), 5), 50);
        $page = max((int) $request->integer('page', 1), 1);

        $paginator = match ($type) {
            'escrow', 'non-escrow', 'credit' => $this->paginateSales($merchant, $type, $perPage),
            'wallet-entry' => $this->paginateWalletEntries($merchant, $perPage),
            'withdrawal' => $this->paginateWithdrawals($merchant, $perPage),
            default => $this->paginateAllLedger($merchant, $user, $page, $perPage),
        };

        return response()->json([
            'history' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'type' => $type,
            ],
        ]);
    }

    private function normalizeLedgerType($type): ?string
    {
        $normalized = str_replace('_', '-', strtolower((string) $type));

        return match ($normalized) {
            'escrow' => 'escrow',
            'non-escrow', 'nonescrow', 'cash', 'in-hand' => 'non-escrow',
            'credit', 'store-credit' => 'credit',
            'wallet-entry', 'wallet-entries', 'earning', 'earnings', 'wallet', 'revenue' => 'wallet-entry',
            'withdraw', 'withdrawal', 'payout', 'payouts' => 'withdrawal',
            default => null,
        };
    }

    private function salesQuery(Merchant $merchant, ?string $type = null)
    {
        $query = Order::query()
            ->where('merchant_id', $merchant->id)
            ->with(['buyer', 'product', 'posStaff.user'])
            ->latest();

        if (! $merchant->isRetailEligible()) {
            $query->where('source', 'online');
        }

        return match ($type) {
            'escrow' => $query->where('source', 'online'),
            'non-escrow' => $query->where('source', 'pos')->whereIn('payment_mode', ['cash', 'merchant_mm', 'online_escrow']),
            'credit' => $query->where('source', 'pos')->where('payment_mode', 'store_credit'),
            default => $query,
        };
    }

    private function paginateSales(Merchant $merchant, string $type, int $perPage)
    {
        return $this->throughPaginator(
            $this->salesQuery($merchant, $type)->paginate($perPage),
            fn(Order $order) => $this->mapSale($order)
        );
    }

    private function paginateWalletEntries(Merchant $merchant, int $perPage)
    {
        return $this->throughPaginator(
            Transaction::query()
                ->where('merchant_id', $merchant->id)
                ->whereIn('type', ['order_revenue', 'platform_fee'])
                ->with(['order.buyer', 'order.product'])
                ->latest()
                ->paginate($perPage),
            fn(Transaction $transaction) => $this->mapTransaction($transaction)
        );
    }

    private function paginateWithdrawals(Merchant $merchant, int $perPage)
    {
        return $this->throughPaginator(
            WithdrawalRequest::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->paginate($perPage),
            fn(WithdrawalRequest $withdrawal) => $this->mapWithdrawal($withdrawal)
        );
    }

    private function paginateAllLedger(Merchant $merchant, $user, int $page, int $perPage): LengthAwarePaginator
    {
        $items = collect()
            ->merge($this->salesQuery($merchant)->limit(200)->get()->map(fn(Order $order) => $this->mapSale($order)))
            ->merge(WithdrawalRequest::query()
                ->where('merchant_id', $merchant->id)
                ->latest()
                ->limit(200)
                ->get()
                ->map(fn(WithdrawalRequest $withdrawal) => $this->mapWithdrawal($withdrawal)))
            ->sortByDesc('created_at')
            ->values();

        return new LengthAwarePaginator(
            $items->forPage($page, $perPage)->values()->all(),
            $items->count(),
            $perPage,
            $page,
            ['path' => request()->url(), 'query' => request()->query()]
        );
    }

    private function throughPaginator($paginator, callable $mapper)
    {
        $paginator->setCollection($paginator->getCollection()->map($mapper));

        return $paginator;
    }

    private function mapWithdrawal(WithdrawalRequest $withdrawal): array
    {
        return [
            'id' => $withdrawal->id,
            'amount' => (float) $withdrawal->amount,
            'method' => $withdrawal->method,
            'status' => $withdrawal->status,
            'created_at' => $withdrawal->created_at->toIso8601String(),
            'type' => 'withdrawal',
            'ledger_type' => 'withdrawal',
        ];
    }

    private function mapTransaction(Transaction $transaction): array
    {
        $order = $transaction->order;
        $grossAmount = (float) $transaction->gross_amount;
        $netAmount = (float) $transaction->net_amount;
        $feeAmount = (float) $transaction->fee_amount;

        if ($feeAmount <= 0 && $grossAmount > $netAmount) {
            $feeAmount = round($grossAmount - $netAmount, 2);
        }

        return [
            'id' => $transaction->id,
            'amount' => $netAmount,
            'gross_amount' => $grossAmount,
            'fee_amount' => $feeAmount,
            'net_amount' => $netAmount,
            'tax_amount' => (float) $transaction->tax_amount,
            'customer_name' => $order?->buyer?->name ?? 'Mteja',
            'product_name' => $order?->product?->title ?? 'Bidhaa',
            'status' => 'completed',
            'created_at' => $transaction->created_at->toIso8601String(),
            'type' => $transaction->type,
            'ledger_type' => 'wallet-entry',
            'reference' => $transaction->reference,
        ];
    }

    private function mapSale(Order $order): array
    {
        $paymentMode = $order->payment_mode ?? 'online_escrow';
        $ledgerType = $order->source === 'online'
            ? 'escrow'
            : ($paymentMode === 'store_credit' ? 'credit' : 'non-escrow');

        $saleTotal = (float) ($order->counter_total ?? $order->grand_total ?? $order->total_paid ?? 0);
        $paidAmount = (float) ($order->total_paid ?? 0);

        return [
            'id' => $order->id,
            'amount' => $saleTotal,
            'paid_amount' => $paidAmount,
            'outstanding_amount' => max($saleTotal - $paidAmount, 0),
            'customer_name' => $order->customer_name ?? $order->buyer?->name ?? 'Mteja',
            'product_name' => $order->product?->title ?? 'Multiple Items',
            'payment_mode' => $paymentMode,
            'ledger_type' => $ledgerType,
            'status' => $order->payment_status,
            'source' => $order->source,
            'created_at' => $order->created_at->toIso8601String(),
            'type' => 'sale',
            'reference' => $order->public_id ? 'POS-' . $order->public_id : ($order->transaction_ref ?? $order->id),
            'staff_name' => $order->posStaff?->user?->name,
        ];
    }

    /**
     * Request a withdrawal
     */
    public function requestWithdrawal(Request $request, Merchant $merchant)
    {
        $user = $request->user();
        
        $request->validate([
            'amount' => 'required|numeric|min:5000',
            'method' => 'required|string',
        ]);

        $wallet = $merchant->wallet()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]
        );

        $amount = (float) $request->amount;

        if (! $merchant->hasCompletedKyc()) {
            return back()->withErrors([
                'amount' => 'Uthibitisho wa Kitambulisho (KYC) unahitajika kabla ya kutoa pesa. Tafadhali kamilisha Verification Center kwanza.',
            ]);
        }

        $enforcementMode = (string) AdminSetting::get('kyc_enforcement_mode', 'off');
        if ($enforcementMode !== 'off' && !$this->isKycApproved($merchant->kyc_status)) {
            $gmvThreshold = (float) AdminSetting::get('kyc_trigger_gmv_tzs', 0);
            $ordersThreshold = (int) AdminSetting::get('kyc_trigger_order_count', 0);
            $withdrawalsThreshold = (float) AdminSetting::get('kyc_trigger_withdrawal_tzs', 0);

            // If any threshold is set to 0, it means it's mandatory from the first transaction
            $merchantGmv = (float) Order::query()
                ->where('merchant_id', $merchant->id)
                ->whereNotIn('payment_status', ['pending', 'failed'])
                ->sum('total_paid');
            $merchantOrderCount = (int) Order::query()
                ->where('merchant_id', $merchant->id)
                ->whereNotIn('payment_status', ['pending', 'failed'])
                ->count();
            $merchantWithdrawals = (float) WithdrawalRequest::query()
                ->where('merchant_id', $merchant->id)
                ->whereIn('status', ['pending', 'approved'])
                ->sum('amount');

            // If thresholds are NOT 0, we check if they are crossed. 
            // If they ARE 0, we treat it as "Mandatory KYC" immediately.
            $mustCompleteKyc = ($gmvThreshold == 0 || $merchantGmv >= $gmvThreshold)
                && ($ordersThreshold == 0 || $merchantOrderCount >= $ordersThreshold)
                && ($withdrawalsThreshold == 0 || $merchantWithdrawals >= $withdrawalsThreshold);

            if ($mustCompleteKyc) {
                return back()->withErrors([
                    'amount' => 'Uthibitisho wa Kitambulisho (KYC) unahitajika kabla ya kutoa pesa. Tafadhali wasilisha maelezo yako kwenye Verification Center.',
                ]);
            }
        }

        if ($wallet->balance < $amount) {
            return back()->withErrors(['amount' => 'Salio halitoshi kufanya muamala huu. (Insufficient balance)']);
        }

        // Deduct the requested amount to prevent double spending
        $wallet->balance -= $amount;
        $wallet->save();

        // Create the pending withdrawal request
        WithdrawalRequest::create([
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'method' => $request->input('method'),
            'amount' => $amount,
            'status' => 'pending',
            'idempotency_key' => Str::uuid(),
        ]);

        return redirect()->back()->with('success', 'Ombi lako limepokelewa na linafanyiwa kazi. (Withdrawal requested successfully)');
    }

    private function isKycApproved(?string $status): bool
    {
        $normalized = strtolower((string) $status);
        return in_array($normalized, ['approved', 'verified'], true);
    }
}
