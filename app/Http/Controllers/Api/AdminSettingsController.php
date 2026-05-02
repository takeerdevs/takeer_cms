<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminSettingsController extends Controller
{
    /**
     * Return all settings + platform stats.
     */
    public function index(): JsonResponse
    {
        $settings = array_merge([
            'ai_provider' => 'openrouter',
            'openrouter_api_key' => '',
            'openrouter_default_model' => 'google/gemini-2.5-flash',
            'gemini_api_key' => '',
            'gemini_default_model' => 'gemini-1.5-flash',
            'kyc_enforcement_mode' => 'off',
            'kyc_trigger_gmv_tzs' => '0',
            'kyc_trigger_order_count' => '0',
            'kyc_trigger_withdrawal_tzs' => '0',
            'catalog_item_picker_default_limit' => '5',
            'upload_allowed_extensions' => 'jpg,jpeg,png,webp,gif,mp4,mov,webm,pdf,zip,doc,docx,xls,xlsx,ppt,pptx,csv,txt',
            'upload_allowed_mime_types' => 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain',
            'upload_max_file_mb' => '500',
            'storage_access_mode' => 'free',
            'storage_free_mb' => '500',
            'storage_trial_days' => '0',
            'retail_access_mode' => 'free',
            'retail_trial_days' => '0',
        ], AdminSetting::allAsMap());

        // Mask secret keys for display (show last 4 chars only)
        foreach (['openrouter_api_key', 'gemini_api_key'] as $keyField) {
            if (!empty($settings[$keyField])) {
                $val = $settings[$keyField];
                $settings[$keyField . '_masked'] = '•••••••' . substr($val, -4);
                $settings[$keyField] = ''; // never expose full key in JSON
            }
        }

        // Platform stats
        $stats = [
            'total_users' => User::count(),
            'total_merchants' => User::where('role', 'merchant')->count(),
            'total_admins' => User::where('is_admin', true)->count(),
            'total_orders' => Order::count(),
            'open_disputes' => Dispute::where('status', 'open')->count(),
            'pending_withdrawals' => WithdrawalRequest::where('status', 'pending')->count(),
        ];

        return response()->json(['settings' => $settings, 'stats' => $stats]);
    }

    /**
     * Batch-update settings from the admin UI.
     */
    public function update(Request $request): JsonResponse
    {
        $allowed = [
            'ai_provider',
            'openrouter_api_key',
            'openrouter_default_model',
            'gemini_api_key',
            'gemini_default_model',
            'kyc_enforcement_mode',
            'kyc_trigger_gmv_tzs',
            'kyc_trigger_order_count',
            'kyc_trigger_withdrawal_tzs',
            'catalog_item_picker_default_limit',
            'upload_allowed_extensions',
            'upload_allowed_mime_types',
            'upload_max_file_mb',
            'storage_access_mode',
            'storage_free_mb',
            'storage_trial_days',
            'retail_access_mode',
            'retail_trial_days',
        ];

        foreach ($allowed as $key) {
            if ($request->has($key)) {
                $value = $request->input($key);
                if ($key === 'catalog_item_picker_default_limit') {
                    $value = (string) max(1, min(20, (int) $value));
                }
                if ($key === 'upload_max_file_mb') {
                    $value = (string) max(1, min(500, (int) $value));
                }
                if (in_array($key, ['storage_access_mode', 'retail_access_mode'], true)) {
                    $value = in_array($value, ['free', 'trial_then_paid', 'paid'], true) ? $value : 'free';
                }
                if (in_array($key, ['storage_free_mb'], true)) {
                    $value = (string) max(0, (int) $value);
                }
                if (in_array($key, ['storage_trial_days', 'retail_trial_days'], true)) {
                    $value = (string) max(0, min(365, (int) $value));
                }
                if (in_array($key, ['upload_allowed_extensions', 'upload_allowed_mime_types'], true)) {
                    $value = collect(preg_split('/[\s,]+/', strtolower((string) $value)))
                        ->map(fn ($item) => trim($item, " \t\n\r\0\x0B."))
                        ->filter()
                        ->unique()
                        ->implode(',');
                }
                // Skip if the field was masked (user didn't change it)
                if ($value === '' && $request->input($key . '_masked')) {
                    continue;
                }
                AdminSetting::set($key, $value);
            }
        }

        return response()->json(['message' => 'Settings saved successfully.']);
    }

    /**
     * Get all users for the Users admin page.
     */
    public function users(Request $request): JsonResponse
    {
        $users = User::select('id', 'name', 'phone_number', 'role', 'is_admin', 'is_banned', 'created_at')
            ->when($request->search, fn($q) => $q->where('name', 'like', '%' . $request->search . '%')
                ->orWhere('phone_number', 'like', '%' . $request->search . '%'))
            ->latest()
            ->paginate(20);

        return response()->json($users);
    }

    /**
     * Toggle merchant or admin role for a user.
     * is_merchant is derived from 'role' field (string), is_admin is a boolean column.
     */
    public function toggleRole(Request $request, User $user): JsonResponse
    {
        $request->validate(['role' => 'required|in:is_merchant,is_admin']);

        $role = $request->input('role');

        if ($role === 'is_merchant') {
            // Toggle between merchant and buyer roles
            $user->update(['role' => $user->role === 'merchant' ? 'buyer' : 'merchant']);
        } else {
            // Toggle is_admin boolean
            $user->update(['is_admin' => !$user->is_admin]);
        }

        return response()->json([
            'message' => 'User role updated successfully.',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'is_merchant' => $user->isMerchant(),
                'is_admin' => $user->isAdmin(),
            ],
        ]);
    }

    /**
     * Toggle user ban status.
     */
    public function toggleBan(User $user): JsonResponse
    {
        $user->update(['is_banned' => !$user->is_banned]);

        return response()->json([
            'message' => $user->is_banned
                ? 'User has been banned.'
                : 'User ban removed.',
            'user' => [
                'id' => $user->id,
                'is_banned' => (bool) $user->is_banned,
            ],
        ]);
    }

    /**
     * Get pending withdrawals.
     */
    public function withdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::with('user:id,name,phone_number')
            ->where('status', 'pending')
            ->latest()
            ->get();

        return response()->json(['withdrawals' => $withdrawals]);
    }

    public function platformWallet(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 5), 50);
        $revenueQuery = Transaction::query()->where('type', 'order_revenue');
        $platformRevenueQuery = Transaction::query()->whereIn('type', ['order_revenue', 'platform_fee']);
        $baseCurrencyCode = (string) (Transaction::query()->whereNotNull('base_currency_code')->value('base_currency_code') ?: 'USD');

        $baseFeeSql = 'COALESCE(SUM(CASE
            WHEN fee_amount_base IS NOT NULL THEN fee_amount_base
            WHEN gross_amount_base IS NOT NULL AND net_amount_base IS NOT NULL AND gross_amount_base > net_amount_base THEN gross_amount_base - net_amount_base
            ELSE 0
        END), 0) as total';

        $totalGmv = (float) (clone $revenueQuery)->sum('gross_amount_base');
        $totalNetToMerchants = (float) (clone $revenueQuery)->sum('net_amount_base');
        $totalTakeerFees = (float) (clone $platformRevenueQuery)
            ->selectRaw($baseFeeSql)
            ->value('total');

        $todayTakeerFees = (float) (clone $platformRevenueQuery)
            ->whereDate('created_at', now()->toDateString())
            ->selectRaw($baseFeeSql)
            ->value('total');

        $thisMonthTakeerFees = (float) (clone $platformRevenueQuery)
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->selectRaw($baseFeeSql)
            ->value('total');

        $nativeCurrencyTotals = (clone $revenueQuery)
            ->selectRaw('currency_code')
            ->selectRaw('COALESCE(SUM(gross_amount), 0) as total_gmv')
            ->selectRaw('COALESCE(SUM(CASE WHEN fee_amount > 0 THEN fee_amount WHEN gross_amount > net_amount THEN gross_amount - net_amount ELSE 0 END), 0) as total_takeer_fees')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as total_net_to_merchants')
            ->selectRaw('COUNT(*) as transaction_count')
            ->groupBy('currency_code')
            ->orderBy('currency_code')
            ->get()
            ->map(fn ($row) => [
                'currency_code' => $row->currency_code ?: 'TZS',
                'total_gmv' => (float) $row->total_gmv,
                'total_takeer_fees' => (float) $row->total_takeer_fees,
                'total_net_to_merchants' => (float) $row->total_net_to_merchants,
                'transaction_count' => (int) $row->transaction_count,
            ])
            ->values();

        $countryTotals = Transaction::query()
            ->where('transactions.type', 'order_revenue')
            ->leftJoin('orders', 'orders.id', '=', 'transactions.order_id')
            ->leftJoin('merchants', 'merchants.id', '=', 'orders.merchant_id')
            ->leftJoin('countries', 'countries.id', '=', 'merchants.country_id')
            ->selectRaw("COALESCE(countries.iso_alpha2, orders.country_code, 'TZ') as country_code")
            ->selectRaw("COALESCE(countries.name, orders.country_code, 'Tanzania') as country_name")
            ->selectRaw('transactions.currency_code')
            ->selectRaw('COALESCE(SUM(transactions.gross_amount), 0) as native_gmv')
            ->selectRaw('COALESCE(SUM(transactions.gross_amount_base), 0) as base_gmv')
            ->selectRaw('COALESCE(SUM(transactions.fee_amount_base), 0) as base_takeer_fees')
            ->selectRaw('COUNT(*) as transaction_count')
            ->groupBy(DB::raw("COALESCE(countries.iso_alpha2, orders.country_code, 'TZ')"))
            ->groupBy(DB::raw("COALESCE(countries.name, orders.country_code, 'Tanzania')"))
            ->groupBy('transactions.currency_code')
            ->orderBy('country_code')
            ->get()
            ->map(fn ($row) => [
                'country_code' => $row->country_code,
                'country_name' => $row->country_name,
                'currency_code' => $row->currency_code ?: 'TZS',
                'native_gmv' => (float) $row->native_gmv,
                'base_gmv' => (float) $row->base_gmv,
                'base_takeer_fees' => (float) $row->base_takeer_fees,
                'transaction_count' => (int) $row->transaction_count,
            ])
            ->values();

        $transactions = Transaction::query()
            ->with(['user:id,name,phone_number', 'order.merchant:id,display_name,username', 'order.buyer:id,name,phone_number', 'order.product:id,title'])
            ->latest()
            ->paginate($perPage)
            ->through(function (Transaction $transaction) use ($baseCurrencyCode) {
                $gross = (float) $transaction->gross_amount;
                $net = (float) $transaction->net_amount;
                $fee = (float) $transaction->fee_amount;

                if ($fee <= 0 && $gross > $net) {
                    $fee = round($gross - $net, 2);
                }

                return [
                    'id' => $transaction->id,
                    'type' => $transaction->type,
                    'currency_code' => $transaction->currency_code ?: 'TZS',
                    'base_currency_code' => $transaction->base_currency_code ?: $baseCurrencyCode,
                    'fx_rate_to_base' => (float) $transaction->fx_rate_to_base,
                    'fx_rate_date' => $transaction->fx_rate_date?->toDateString(),
                    'gross_amount' => $gross,
                    'fee_amount' => $fee,
                    'net_amount' => $net,
                    'tax_amount' => (float) $transaction->tax_amount,
                    'gross_amount_base' => (float) $transaction->gross_amount_base,
                    'fee_amount_base' => (float) ($transaction->fee_amount_base ?: max(0, (float) $transaction->gross_amount_base - (float) $transaction->net_amount_base)),
                    'net_amount_base' => (float) $transaction->net_amount_base,
                    'tax_amount_base' => (float) $transaction->tax_amount_base,
                    'reference' => $transaction->reference,
                    'created_at' => $transaction->created_at?->toIso8601String(),
                    'merchant' => $transaction->order?->merchant ? [
                        'id' => $transaction->order->merchant->id,
                        'name' => $transaction->order->merchant->display_name,
                        'username' => $transaction->order->merchant->username,
                    ] : null,
                    'customer' => $transaction->order?->buyer ? [
                        'id' => $transaction->order->buyer->id,
                        'name' => $transaction->order->buyer->name,
                        'phone_number' => $transaction->order->buyer->phone_number,
                    ] : ($transaction->user ? [
                        'id' => $transaction->user->id,
                        'name' => $transaction->user->name,
                        'phone_number' => $transaction->user->phone_number,
                    ] : null),
                    'product_name' => $transaction->order?->product?->title,
                    'order_id' => $transaction->order_id,
                ];
            });

        return response()->json([
            'metrics' => [
                'base_currency_code' => $baseCurrencyCode,
                'total_gmv' => $totalGmv,
                'total_takeer_fees' => $totalTakeerFees,
                'today_takeer_fees' => $todayTakeerFees,
                'this_month_takeer_fees' => $thisMonthTakeerFees,
                'total_net_to_merchants' => $totalNetToMerchants,
                'pending_withdrawals' => (float) WithdrawalRequest::where('status', 'pending')->sum('amount'),
                'total_transactions' => Transaction::count(),
                'total_orders' => Order::count(),
                'online_escrow_gmv' => (float) Order::where('source', 'online')->sum('total_paid'),
                'pos_non_escrow_gmv' => (float) Order::where('source', 'pos')->whereIn('payment_mode', ['cash', 'merchant_mm', 'online_escrow'])->sum('total_paid'),
                'credit_gmv' => (float) Order::where('source', 'pos')->where('payment_mode', 'store_credit')->sum('grand_total'),
            ],
            'native_currency_totals' => $nativeCurrencyTotals,
            'country_totals' => $countryTotals,
            'transactions' => $transactions,
        ]);
    }
}
