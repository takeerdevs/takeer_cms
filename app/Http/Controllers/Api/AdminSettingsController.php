<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\PaymentProviderChannel;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Models\Dispute;
use App\Services\PayoutPolicyService;
use App\Services\PaymentProviderCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminSettingsController extends Controller
{
    /**
     * Return all settings + platform stats.
     */
    public function index(): JsonResponse
    {
        $payoutPolicy = app(PayoutPolicyService::class);
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
            'analytics_retention_days' => '365',
            'analytics_exclude_admins' => '1',
            'withdrawal_payout_channels' => json_encode($this->defaultWithdrawalPayoutChannels()),
            'withdrawal_fx_margin_bps' => '0',
            'withdrawal_fx_margin_bps_paypal' => '350',
            'withdrawal_fx_margin_bps_bank' => '0',
            'withdrawal_fx_margin_bps_mobile_money' => '0',
            'withdrawal_fee_fixed_paypal_usd' => '0',
            'withdrawal_fee_fixed_bank_usd' => '0',
            'withdrawal_fee_fixed_bank_tzs' => '0',
            'withdrawal_fee_fixed_mobile_money_tzs' => '0',
        ], $payoutPolicy->defaultSettings(), AdminSetting::allAsMap());

        if (Schema::hasTable('payment_provider_channels')) {
            app(PaymentProviderCatalogService::class)->ensureDefaults();
            $settings['withdrawal_payout_channels'] = json_encode(
                PaymentProviderChannel::query()
                    ->with('provider')
                    ->where('direction', 'payout')
                    ->orderBy('country_code')
                    ->orderBy('priority')
                    ->get()
                    ->map(fn (PaymentProviderChannel $channel) => $this->payoutChannelSettingRow($channel))
                    ->values()
                    ->all()
            );
        }

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

        return response()->json([
            'settings' => $settings,
            'stats' => $stats,
            'payout_policy' => [
                'buckets' => PayoutPolicyService::BUCKETS,
                'modes' => collect(PayoutPolicyService::ACTIVE_MODES)
                    ->mapWithKeys(fn (string $mode) => [$mode => $payoutPolicy->labels()[$mode]])
                    ->all(),
            ],
        ]);
    }

    /**
     * Batch-update settings from the admin UI.
     */
    public function update(Request $request): JsonResponse
    {
        $payoutPolicy = app(PayoutPolicyService::class);
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
            'analytics_retention_days',
            'analytics_exclude_admins',
            'withdrawal_payout_channels',
            'withdrawal_fx_margin_bps',
            'withdrawal_fx_margin_bps_paypal',
            'withdrawal_fx_margin_bps_bank',
            'withdrawal_fx_margin_bps_mobile_money',
            'withdrawal_fee_fixed_paypal_usd',
            'withdrawal_fee_fixed_bank_usd',
            'withdrawal_fee_fixed_bank_tzs',
            'withdrawal_fee_fixed_mobile_money_tzs',
            ...array_keys($payoutPolicy->defaultSettings()),
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
                if ($key === 'analytics_retention_days') {
                    $value = (string) max(30, min(1095, (int) $value));
                }
                if ($key === 'analytics_exclude_admins') {
                    $value = filter_var($value, FILTER_VALIDATE_BOOLEAN) ? '1' : '0';
                }
                if ($key === 'withdrawal_payout_channels') {
                    $channels = $this->sanitizeWithdrawalPayoutChannels($value);
                    $value = json_encode($channels);
                    if (Schema::hasTable('payment_provider_channels')) {
                        app(PaymentProviderCatalogService::class)->ensureDefaults();
                        $this->syncWithdrawalPayoutChannels($channels);
                    }
                }
                if (str_starts_with($key, 'withdrawal_fx_margin_bps')) {
                    $value = (string) max(0, min(5000, (int) $value));
                }
                if (str_starts_with($key, 'withdrawal_fee_fixed_')) {
                    $value = (string) max(0, round((float) $value, 2));
                }
                if (str_starts_with($key, 'payout_policy_')) {
                    $value = in_array($value, PayoutPolicyService::ACTIVE_MODES, true)
                        ? $value
                        : ($payoutPolicy->defaultSettings()[$key] ?? PayoutPolicyService::MODE_AUTOMATIC);
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

    private function defaultWithdrawalPayoutChannels(): array
    {
        return [
            [
                'key' => 'tz_selcom_mobile_money_tzs',
                'label' => 'Selcom Mobile Money',
                'country_code' => 'TZ',
                'provider' => 'selcom',
                'method' => 'mobile_money',
                'currency_code' => 'TZS',
                'enabled' => true,
                'fx_margin_bps' => 0,
                'fee_type' => 'fixed_plus_percent',
                'fee_fixed' => 0,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
            ],
            [
                'key' => 'tz_selcom_bank_tzs',
                'label' => 'Selcom Bank Transfer',
                'country_code' => 'TZ',
                'provider' => 'selcom',
                'method' => 'bank',
                'currency_code' => 'TZS',
                'enabled' => true,
                'fx_margin_bps' => 0,
                'fee_type' => 'fixed_plus_percent',
                'fee_fixed' => 0,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
            ],
        ];
    }

    private function sanitizeWithdrawalPayoutChannels(mixed $value): array
    {
        $channels = is_string($value) ? json_decode($value, true) : $value;
        if (! is_array($channels)) {
            return $this->defaultWithdrawalPayoutChannels();
        }

        return collect($channels)
            ->filter(fn ($channel) => is_array($channel))
            ->map(fn (array $channel) => $this->sanitizeWithdrawalPayoutChannel($channel))
            ->filter(fn (array $channel) => $channel['label'] !== '' && $channel['currency_code'] !== '')
            ->values()
            ->all();
    }

    private function sanitizeWithdrawalPayoutChannel(array $channel): array
    {
        $countryCode = strtoupper(substr((string) ($channel['country_code'] ?? '*'), 0, 2)) ?: '*';
        $provider = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', (string) ($channel['provider'] ?? 'manual')));
        $method = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', (string) ($channel['method'] ?? 'bank')));
        $currencyCode = strtoupper(substr((string) ($channel['currency_code'] ?? ''), 0, 3));
        $key = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', (string) ($channel['key'] ?? '')));

        if ($key === '' || $key === '_') {
            $key = strtolower(trim("{$countryCode}_{$provider}_{$method}_{$currencyCode}", '_'));
        }

        $feeType = (string) ($channel['fee_type'] ?? 'fixed_plus_percent');
        if (! in_array($feeType, ['none', 'fixed', 'percent', 'fixed_plus_percent'], true)) {
            $feeType = 'fixed_plus_percent';
        }

        $feeMax = $channel['fee_max'] ?? null;
        $feeMax = $feeMax === '' || $feeMax === null ? null : max(0, round((float) $feeMax, 2));

        return [
            'id' => isset($channel['id']) ? (int) $channel['id'] : null,
            'key' => $key,
            'label' => trim((string) ($channel['label'] ?? '')),
            'country_code' => $countryCode,
            'provider' => $provider ?: 'manual',
            'provider_id' => isset($channel['provider_id']) ? (int) $channel['provider_id'] : null,
            'method' => $method ?: 'bank',
            'currency_code' => $currencyCode,
            'currencies' => collect($channel['currencies'] ?? [$currencyCode])
                ->map(fn ($code) => strtoupper(substr((string) $code, 0, 3)))
                ->filter()
                ->unique()
                ->values()
                ->all(),
            'enabled' => filter_var($channel['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'fx_margin_bps' => max(0, min(5000, (int) ($channel['fx_margin_bps'] ?? 0))),
            'fee_type' => $feeType,
            'fee_fixed' => max(0, round((float) ($channel['fee_fixed'] ?? 0), 2)),
            'fee_percent_bps' => max(0, min(10000, (int) ($channel['fee_percent_bps'] ?? 0))),
            'fee_min' => max(0, round((float) ($channel['fee_min'] ?? 0), 2)),
            'fee_max' => $feeMax,
        ];
    }

    private function payoutChannelSettingRow(PaymentProviderChannel $channel): array
    {
        $currencies = $channel->currencies ?: ['TZS'];

        return [
            'id' => $channel->id,
            'key' => $channel->key,
            'label' => $channel->name,
            'country_code' => $channel->country_code,
            'provider' => $channel->provider?->key ?: 'manual',
            'provider_id' => $channel->payment_provider_id,
            'method' => $channel->method,
            'currency_code' => $currencies[0] ?? 'TZS',
            'currencies' => $currencies,
            'enabled' => $channel->status !== 'disabled',
            'status' => $channel->status,
            'fx_margin_bps' => (int) $channel->fx_margin_bps,
            'fee_type' => $channel->fee_type,
            'fee_fixed' => (float) $channel->fee_fixed,
            'fee_percent_bps' => (int) $channel->fee_percent_bps,
            'fee_min' => (float) $channel->fee_min,
            'fee_max' => $channel->fee_max !== null ? (float) $channel->fee_max : null,
        ];
    }

    private function syncWithdrawalPayoutChannels(array $channels): void
    {
        foreach ($channels as $channel) {
            if (empty($channel['id']) && empty($channel['provider_id'])) {
                continue;
            }

            $record = ! empty($channel['id'])
                ? PaymentProviderChannel::query()->find($channel['id'])
                : null;

            if (! $record && ! empty($channel['provider_id'])) {
                $record = PaymentProviderChannel::query()->firstOrNew(['key' => $channel['key']]);
                $record->payment_provider_id = (int) $channel['provider_id'];
            }

            if (! $record) {
                continue;
            }

            $record->fill([
                'key' => $channel['key'],
                'country_code' => $channel['country_code'],
                'direction' => 'payout',
                'method' => $channel['method'],
                'name' => $channel['label'],
                'currencies' => $channel['currencies'] ?: [$channel['currency_code']],
                'status' => $channel['enabled'] ? ($channel['status'] ?? 'enabled') : 'disabled',
                'fee_type' => $channel['fee_type'],
                'fee_fixed' => $channel['fee_fixed'],
                'fee_percent_bps' => $channel['fee_percent_bps'],
                'fee_min' => $channel['fee_min'],
                'fee_max' => $channel['fee_max'],
                'fx_margin_bps' => $channel['fx_margin_bps'],
            ])->save();
        }
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
        $withdrawals = WithdrawalRequest::with(['user:id,name,phone_number', 'merchant:id,display_name,username,currency_id', 'merchant.currency:id,code'])
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(function (WithdrawalRequest $withdrawal) {
                $snapshot = $withdrawal->payout_snapshot ?: [];

                return [
                    'id' => $withdrawal->id,
                    'amount' => (float) $withdrawal->amount,
                    'merchant_amount' => $withdrawal->merchant_amount !== null ? (float) $withdrawal->merchant_amount : (float) $withdrawal->amount,
                    'payout_amount' => $withdrawal->payout_amount !== null ? (float) $withdrawal->payout_amount : (float) $withdrawal->amount,
                    'wallet_debit_amount' => (float) ($snapshot['wallet_debit_amount'] ?? 0),
                    'withdrawal_fee_amount' => (float) ($snapshot['merchant_fee_amount'] ?? 0),
                    'withdrawal_fee_currency_code' => $snapshot['merchant_fee_currency_code'] ?? null,
                    'provider_cost_amount' => (float) ($snapshot['provider_cost_amount'] ?? 0),
                    'provider_cost_currency_code' => $snapshot['provider_cost_currency_code'] ?? null,
                    'merchant_currency_code' => $withdrawal->merchant_currency_code ?: $withdrawal->merchant?->currency?->code ?: 'TZS',
                    'payout_currency_code' => $withdrawal->payout_currency_code ?: $withdrawal->merchant_currency_code ?: $withdrawal->merchant?->currency?->code ?: 'TZS',
                    'fx_rate_merchant_to_payout' => $withdrawal->fx_rate_merchant_to_payout !== null ? (float) $withdrawal->fx_rate_merchant_to_payout : null,
                    'fx_market_rate_merchant_to_payout' => $withdrawal->fx_market_rate_merchant_to_payout !== null ? (float) $withdrawal->fx_market_rate_merchant_to_payout : null,
                    'fx_effective_rate_merchant_to_payout' => $withdrawal->fx_effective_rate_merchant_to_payout !== null ? (float) $withdrawal->fx_effective_rate_merchant_to_payout : null,
                    'fx_spread_bps' => (int) $withdrawal->fx_spread_bps,
                    'fx_spread_amount' => $withdrawal->fx_spread_amount !== null ? (float) $withdrawal->fx_spread_amount : 0,
                    'fx_spread_currency_code' => $withdrawal->fx_spread_currency_code,
                    'fx_rate_date' => $withdrawal->fx_rate_date?->toDateString(),
                    'payout_snapshot' => $withdrawal->payout_snapshot ?: [],
                    'money_quote_snapshot' => $withdrawal->money_quote_snapshot ?: [],
                    'method' => $withdrawal->method,
                    'status' => $withdrawal->status,
                    'created_at' => $withdrawal->created_at?->toISOString(),
                    'user' => $withdrawal->user,
                    'merchant' => $withdrawal->merchant ? [
                        'id' => $withdrawal->merchant->id,
                        'display_name' => $withdrawal->merchant->display_name,
                        'username' => $withdrawal->merchant->username,
                    ] : null,
                ];
            });

        return response()->json(['withdrawals' => $withdrawals]);
    }

    public function platformWallet(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->integer('per_page', 20), 5), 50);
        $revenueQuery = Transaction::query()->where('type', 'order_revenue');
        $platformRevenueQuery = Transaction::query()->whereIn('type', ['order_revenue', 'platform_fee']);
        $baseCurrencyCode = (string) (Transaction::query()->whereNotNull('base_currency_code')->value('base_currency_code') ?: 'USD');

        $baseFeeSql = 'COALESCE(SUM(COALESCE(fee_amount_base, 0)), 0) as total';
        $baseProviderCostSql = 'COALESCE(SUM(COALESCE(provider_cost_amount_base, 0)), 0) as total';
        $baseTakeerMarginSql = 'COALESCE(SUM(COALESCE(takeer_margin_amount_base, 0)), 0) as total';

        $totalGmv = (float) (clone $revenueQuery)->sum('gross_amount_base');
        $totalNetToMerchants = (float) (clone $revenueQuery)->sum('net_amount_base');
        $totalTakeerFees = (float) (clone $platformRevenueQuery)
            ->selectRaw($baseFeeSql)
            ->value('total');
        $totalProviderCosts = (float) (clone $platformRevenueQuery)
            ->selectRaw($baseProviderCostSql)
            ->value('total');
        $totalTakeerMargin = (float) (clone $platformRevenueQuery)
            ->selectRaw($baseTakeerMarginSql)
            ->value('total');

        $todayTakeerFees = (float) (clone $platformRevenueQuery)
            ->whereDate('created_at', now()->toDateString())
            ->selectRaw($baseFeeSql)
            ->value('total');
        $todayTakeerMargin = (float) (clone $platformRevenueQuery)
            ->whereDate('created_at', now()->toDateString())
            ->selectRaw($baseTakeerMarginSql)
            ->value('total');

        $thisMonthTakeerFees = (float) (clone $platformRevenueQuery)
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->selectRaw($baseFeeSql)
            ->value('total');
        $thisMonthTakeerMargin = (float) (clone $platformRevenueQuery)
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->selectRaw($baseTakeerMarginSql)
            ->value('total');

        $hasOrderFxAudit = Schema::hasColumn('orders', 'fx_spread_amount');
        $hasWithdrawalFxAudit = Schema::hasColumn('withdrawal_requests', 'fx_spread_amount');
        $orderFxSpreadBase = $hasOrderFxAudit
            ? (float) Order::query()
                ->where('fx_spread_amount', '>', 0)
                ->selectRaw('COALESCE(SUM(CASE WHEN fx_rate_customer_to_base > 0 THEN fx_spread_amount / fx_rate_customer_to_base ELSE 0 END), 0) as total')
                ->value('total')
            : 0.0;
        $withdrawalFxSpreadBase = $hasWithdrawalFxAudit
            ? (float) WithdrawalRequest::query()
                ->where('fx_spread_amount', '>', 0)
                ->selectRaw('COALESCE(SUM(CASE WHEN fx_rate_payout_to_base > 0 THEN fx_spread_amount / fx_rate_payout_to_base ELSE 0 END), 0) as total')
                ->value('total')
            : 0.0;

        $fxSpreadTotals = collect();
        if ($hasOrderFxAudit) {
            $fxSpreadTotals = $fxSpreadTotals->merge(
                Order::query()
                    ->where('fx_spread_amount', '>', 0)
                    ->selectRaw("COALESCE(fx_spread_currency_code, customer_currency_code, 'TZS') as currency_code")
                    ->selectRaw('COALESCE(SUM(fx_spread_amount), 0) as amount')
                    ->selectRaw('COUNT(*) as quote_count')
                    ->groupBy(DB::raw("COALESCE(fx_spread_currency_code, customer_currency_code, 'TZS')"))
                    ->get()
                    ->map(fn ($row) => [
                        'source' => 'payin',
                        'currency_code' => $row->currency_code,
                        'amount' => (float) $row->amount,
                        'quote_count' => (int) $row->quote_count,
                    ])
            );
        }
        if ($hasWithdrawalFxAudit) {
            $fxSpreadTotals = $fxSpreadTotals->merge(
                WithdrawalRequest::query()
                    ->where('fx_spread_amount', '>', 0)
                    ->selectRaw("COALESCE(fx_spread_currency_code, payout_currency_code, 'TZS') as currency_code")
                    ->selectRaw('COALESCE(SUM(fx_spread_amount), 0) as amount')
                    ->selectRaw('COUNT(*) as quote_count')
                    ->groupBy(DB::raw("COALESCE(fx_spread_currency_code, payout_currency_code, 'TZS')"))
                    ->get()
                    ->map(fn ($row) => [
                        'source' => 'payout',
                        'currency_code' => $row->currency_code,
                        'amount' => (float) $row->amount,
                        'quote_count' => (int) $row->quote_count,
                    ])
            );
        }
        $fxSpreadTotals = $fxSpreadTotals->values();

        $recentFxQuotes = collect();
        if ($hasOrderFxAudit) {
            $recentFxQuotes = $recentFxQuotes->merge(
                Order::query()
                    ->with(['merchant:id,display_name,username'])
                    ->where('fx_spread_amount', '>', 0)
                    ->latest()
                    ->limit(10)
                    ->get()
                    ->map(fn (Order $order) => [
                        'id' => $order->id,
                        'source' => 'payin',
                        'reference' => $order->transaction_ref,
                        'merchant' => $order->merchant ? [
                            'name' => $order->merchant->display_name,
                            'username' => $order->merchant->username,
                        ] : null,
                        'from_currency_code' => $order->merchant_currency_code ?: 'TZS',
                        'to_currency_code' => $order->customer_currency_code ?: $order->fx_spread_currency_code ?: 'TZS',
                        'market_rate' => $order->fx_market_rate_merchant_to_customer !== null ? (float) $order->fx_market_rate_merchant_to_customer : null,
                        'effective_rate' => $order->fx_effective_rate_merchant_to_customer !== null ? (float) $order->fx_effective_rate_merchant_to_customer : (float) $order->fx_rate_merchant_to_customer,
                        'fx_spread_bps' => (int) $order->fx_spread_bps,
                        'fx_spread_amount' => (float) $order->fx_spread_amount,
                        'fx_spread_currency_code' => $order->fx_spread_currency_code ?: $order->customer_currency_code ?: 'TZS',
                        'created_at' => $order->created_at?->toIso8601String(),
                    ])
            );
        }
        if ($hasWithdrawalFxAudit) {
            $recentFxQuotes = $recentFxQuotes->merge(
                WithdrawalRequest::query()
                    ->with(['merchant:id,display_name,username'])
                    ->where('fx_spread_amount', '>', 0)
                    ->latest()
                    ->limit(10)
                    ->get()
                    ->map(fn (WithdrawalRequest $withdrawal) => [
                        'id' => $withdrawal->id,
                        'source' => 'payout',
                        'reference' => $withdrawal->idempotency_key,
                        'merchant' => $withdrawal->merchant ? [
                            'name' => $withdrawal->merchant->display_name,
                            'username' => $withdrawal->merchant->username,
                        ] : null,
                        'from_currency_code' => $withdrawal->merchant_currency_code ?: 'TZS',
                        'to_currency_code' => $withdrawal->payout_currency_code ?: $withdrawal->fx_spread_currency_code ?: 'TZS',
                        'market_rate' => $withdrawal->fx_market_rate_merchant_to_payout !== null ? (float) $withdrawal->fx_market_rate_merchant_to_payout : null,
                        'effective_rate' => $withdrawal->fx_effective_rate_merchant_to_payout !== null ? (float) $withdrawal->fx_effective_rate_merchant_to_payout : (float) $withdrawal->fx_rate_merchant_to_payout,
                        'fx_spread_bps' => (int) $withdrawal->fx_spread_bps,
                        'fx_spread_amount' => (float) $withdrawal->fx_spread_amount,
                        'fx_spread_currency_code' => $withdrawal->fx_spread_currency_code ?: $withdrawal->payout_currency_code ?: 'TZS',
                        'created_at' => $withdrawal->created_at?->toIso8601String(),
                    ])
            );
        }
        $recentFxQuotes = $recentFxQuotes
            ->sortByDesc('created_at')
            ->take(12)
            ->values();

        $nativeCurrencyTotals = (clone $revenueQuery)
            ->selectRaw('currency_code')
            ->selectRaw('COALESCE(SUM(gross_amount), 0) as total_gmv')
            ->selectRaw('COALESCE(SUM(COALESCE(fee_amount, 0)), 0) as total_takeer_fees')
            ->selectRaw('COALESCE(SUM(COALESCE(provider_cost_amount, 0)), 0) as total_provider_costs')
            ->selectRaw('COALESCE(SUM(COALESCE(takeer_margin_amount, 0)), 0) as total_takeer_margin')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as total_net_to_merchants')
            ->selectRaw('COUNT(*) as transaction_count')
            ->groupBy('currency_code')
            ->orderBy('currency_code')
            ->get()
            ->map(fn ($row) => [
                'currency_code' => $row->currency_code ?: 'TZS',
                'total_gmv' => (float) $row->total_gmv,
                'total_takeer_fees' => (float) $row->total_takeer_fees,
                'total_provider_costs' => (float) $row->total_provider_costs,
                'total_takeer_margin' => (float) $row->total_takeer_margin,
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
            ->selectRaw('COALESCE(SUM(COALESCE(transactions.provider_cost_amount_base, 0)), 0) as base_provider_costs')
            ->selectRaw('COALESCE(SUM(COALESCE(transactions.takeer_margin_amount_base, 0)), 0) as base_takeer_margin')
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
                'base_provider_costs' => (float) $row->base_provider_costs,
                'base_takeer_margin' => (float) $row->base_takeer_margin,
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
                $providerCost = (float) ($transaction->provider_cost_amount ?? 0);
                $takeerMargin = (float) ($transaction->takeer_margin_amount ?? 0);

                return [
                    'id' => $transaction->id,
                    'type' => $transaction->type,
                    'currency_code' => $transaction->currency_code ?: 'TZS',
                    'base_currency_code' => $transaction->base_currency_code ?: $baseCurrencyCode,
                    'fx_rate_to_base' => (float) $transaction->fx_rate_to_base,
                    'fx_rate_date' => $transaction->fx_rate_date?->toDateString(),
                    'gross_amount' => $gross,
                    'fee_amount' => $fee,
                    'provider_cost_amount' => $providerCost,
                    'takeer_margin_amount' => $takeerMargin,
                    'net_amount' => $net,
                    'tax_amount' => (float) $transaction->tax_amount,
                    'gross_amount_base' => (float) $transaction->gross_amount_base,
                    'fee_amount_base' => (float) ($transaction->fee_amount_base ?? 0),
                    'provider_cost_amount_base' => (float) ($transaction->provider_cost_amount_base ?? 0),
                    'takeer_margin_amount_base' => (float) ($transaction->takeer_margin_amount_base ?? 0),
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
                'total_provider_costs' => $totalProviderCosts,
                'total_takeer_margin' => $totalTakeerMargin,
                'today_takeer_fees' => $todayTakeerFees,
                'today_takeer_margin' => $todayTakeerMargin,
                'this_month_takeer_fees' => $thisMonthTakeerFees,
                'this_month_takeer_margin' => $thisMonthTakeerMargin,
                'total_fx_spread' => round($orderFxSpreadBase + $withdrawalFxSpreadBase, 2),
                'payin_fx_spread' => round($orderFxSpreadBase, 2),
                'payout_fx_spread' => round($withdrawalFxSpreadBase, 2),
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
            'fx_spread_totals' => $fxSpreadTotals,
            'recent_fx_quotes' => $recentFxQuotes,
            'transactions' => $transactions,
        ]);
    }
}
