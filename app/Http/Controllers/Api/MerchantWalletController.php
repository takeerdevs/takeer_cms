<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
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
        $user = $request->user();
        
        // Ensure wallet exists
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'frozen_balance' => 0]
        );

        return Inertia::render('Merchant/Wallet', [
            'merchant' => $merchant,
            'merchantUsername' => $merchant->username,
            'merchantName' => $merchant->display_name,
            'wallet' => [
                'balance' => (float) $wallet->balance,
                'frozen_balance' => (float) $wallet->frozen_balance,
            ],
        ]);
    }

    /**
     * Get recent transactions and withdrawals (API).
     */
    public function history(Request $request, Merchant $merchant)
    {
        $user = $request->user();
        
        // We fetch the withdrawal requests for the user.
        $withdrawals = WithdrawalRequest::where('user_id', $user->id)
            ->latest()
            ->take(10)
            ->get()
            ->map(function($req) {
                return [
                    'id' => $req->id,
                    'amount' => (float) $req->amount,
                    'status' => $req->status,
                    'created_at' => $req->created_at->toIso8601String(),
                    'type' => 'withdrawal',
                ];
            });

        // We fetch the recent transactions (earnings/fees)
        $transactions = $user->wallet ? $user->wallet->transactions()
            ->with(['order.buyer', 'order.product'])
            ->latest()
            ->take(20)
            ->get()
            ->map(function($tx) {
                $order = $tx->order;
                $customerName = $order?->buyer?->name ?? 'Mteja';
                $productName = $order?->product?->title ?? 'Bidhaa';
                
                return [
                    'id' => $tx->id,
                    'amount' => (float) $tx->net_amount, // For legacy compatibility
                    'gross_amount' => (float) $tx->gross_amount,
                    'fee_amount' => (float) $tx->fee_amount,
                    'net_amount' => (float) $tx->net_amount,
                    'tax_amount' => (float) $tx->tax_amount,
                    'customer_name' => $customerName,
                    'product_name' => $productName,
                    'status' => 'completed',
                    'created_at' => $tx->created_at->toIso8601String(),
                    'type' => $tx->type,
                    'reference' => $tx->reference,
                ];
            }) : collect();

        // Merge and sort
        $history = collect($withdrawals)->merge($transactions)
            ->sortByDesc('created_at')
            ->values()
            ->all();

        return response()->json([
            'history' => $history,
        ]);
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

        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->id],
            ['balance' => 0, 'frozen_balance' => 0]
        );

        $amount = (float) $request->amount;

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
                ->where('user_id', $user->id)
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
            'amount' => $amount,
            'status' => 'pending',
            // Eventually add 'method' column if needed, for now we just use the existing schema
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
