<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AdminSetting;
use App\Models\Order;
use App\Models\Transaction;
use App\Models\WithdrawalRequest;
use App\Services\CurrencyConversionService;
use App\Services\MoneyQuoteService;
use App\Services\PaymentChannelRouter;
use App\Services\StepUpVerificationService;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Log;
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
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);
        
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
                'currency_code' => $merchant->currency?->code ?: 'TZS',
                'currency' => $merchant->currency ? [
                    'code' => $merchant->currency->code,
                    'name' => $merchant->currency->name,
                    'symbol' => $merchant->currency->symbol,
                    'symbol_position' => $merchant->currency->symbol_position,
                ] : null,
                'payout_currencies' => $this->payoutCurrencyOptions($merchant),
                'payout_channels' => $this->payoutChannelsForMerchant($merchant),
                'payout_credentials' => app(PaymentChannelRouter::class)->payoutCredentialsForMerchant($merchant),
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
            'merchant_amount' => $withdrawal->merchant_amount !== null ? (float) $withdrawal->merchant_amount : (float) $withdrawal->amount,
            'payout_amount' => $withdrawal->payout_amount !== null ? (float) $withdrawal->payout_amount : (float) $withdrawal->amount,
            'merchant_currency_code' => $withdrawal->merchant_currency_code,
            'payout_currency_code' => $withdrawal->payout_currency_code,
            'fx_rate_merchant_to_payout' => $withdrawal->fx_rate_merchant_to_payout !== null ? (float) $withdrawal->fx_rate_merchant_to_payout : null,
            'fx_rate_date' => $withdrawal->fx_rate_date?->toDateString(),
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
    public function quoteWithdrawal(Request $request, Merchant $merchant)
    {
        try {
            $merchant->loadMissing(['currency', 'country.defaultCurrency']);

            $validated = $request->validate([
                'amount' => 'required|numeric|min:0.01',
                'method' => 'required|string',
                'payout_currency_code' => 'nullable|string|size:3',
                'payout_channel_key' => 'nullable|string|max:100',
                'merchant_payout_credential_id' => 'nullable|integer',
            ]);

            $currencyConverter = app(CurrencyConversionService::class);
            $merchantCurrencyCode = $merchant->currency?->code ?: $currencyConverter->merchantCurrencyCode((int) $merchant->id);
            $channel = $this->resolvePayoutChannel(
                $merchant,
                $validated['payout_channel_key'] ?? null,
                (string) $validated['method'],
                $validated['payout_currency_code'] ?? null,
                $validated['merchant_payout_credential_id'] ?? null
            );
            $payoutCurrencyCode = $channel['currency_code'];
            if ($limitError = $this->withdrawalLimitError((float) $validated['amount'], $merchantCurrencyCode, $channel)) {
                return response()->json(['message' => $limitError], 422);
            }

            $moneySnapshot = app(MoneyQuoteService::class)->payoutQuote(
                (float) $validated['amount'],
                $merchantCurrencyCode,
                $payoutCurrencyCode,
                (int) ($channel['fx_margin_bps'] ?? $this->withdrawalFxMarginBps((string) $channel['method'])),
            );

            return response()->json($this->withdrawalQuotePayload($moneySnapshot, $channel));
        } catch (\Throwable $exception) {
            Log::warning('Withdrawal quote failed', [
                'merchant_id' => $merchant->id,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Imeshindwa kupata makadirio ya payout. Hakikisha exchange rates na payout settings zipo sawa.',
            ], 422);
        }
    }

    public function requestWithdrawal(Request $request, Merchant $merchant)
    {
        $user = $request->user();
        $stepUp = app(StepUpVerificationService::class);
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);
        
        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'method' => 'required|string',
            'payout_currency_code' => 'nullable|string|size:3',
            'payout_channel_key' => 'nullable|string|max:100',
            'merchant_payout_credential_id' => 'nullable|integer',
            'verification_code' => 'nullable|string|max:32',
        ]);

        if (! $stepUp->recentlyVerified($request, 'merchant_wallet_withdrawal')) {
            $code = (string) $request->input('verification_code', '');
            if ($code === '') {
                return back()->withErrors([
                    'verification_code' => 'Tuma verification code kisha uiweke hapa kabla ya kutoa pesa.',
                ]);
            }

            if (! $stepUp->verify($request, 'merchant_wallet_withdrawal', $code)) {
                return back()->withErrors([
                    'verification_code' => 'Verification code si sahihi au imeisha muda wake.',
                ]);
            }
        }

        $wallet = $merchant->wallet()->firstOrCreate(
            ['merchant_id' => $merchant->id],
            ['user_id' => $user->id, 'balance' => 0, 'frozen_balance' => 0]
        );

        $amount = (float) $request->amount;
        $currencyConverter = app(CurrencyConversionService::class);
        $merchantCurrencyCode = $merchant->currency?->code ?: $currencyConverter->merchantCurrencyCode((int) $merchant->id);
        $channel = $this->resolvePayoutChannel(
            $merchant,
            $request->input('payout_channel_key'),
            (string) $request->input('method'),
            $request->input('payout_currency_code'),
            $request->input('merchant_payout_credential_id')
        );
        $method = $channel['method'];
        $payoutCurrencyCode = $channel['currency_code'];

        if ($limitError = $this->withdrawalLimitError($amount, $merchantCurrencyCode, $channel)) {
            return back()->withErrors([
                'amount' => $limitError,
            ]);
        }

        $moneySnapshot = app(MoneyQuoteService::class)->payoutQuote(
            $amount,
            $merchantCurrencyCode,
            $payoutCurrencyCode,
            (int) ($channel['fx_margin_bps'] ?? $this->withdrawalFxMarginBps((string) $channel['method'])),
        );
        $quote = $this->withdrawalQuotePayload($moneySnapshot, $channel);

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
            'method' => $method,
            'payment_provider_id' => $channel['provider_id'] ?? null,
            'payment_provider_channel_id' => $channel['id'] ?? null,
            'merchant_payout_credential_id' => $request->input('merchant_payout_credential_id') ?: null,
            'amount' => $amount,
            'merchant_currency_code' => $moneySnapshot['merchant_currency_code'],
            'payout_currency_code' => $moneySnapshot['customer_currency_code'],
            'fx_base_currency_code' => $moneySnapshot['fx_base_currency_code'],
            'fx_rate_merchant_to_base' => $moneySnapshot['fx_rate_merchant_to_base'],
            'fx_rate_payout_to_base' => $moneySnapshot['fx_rate_customer_to_base'],
            'fx_rate_merchant_to_payout' => $quote['effective_rate_merchant_to_payout'],
            'fx_market_rate_merchant_to_payout' => $quote['market_rate_merchant_to_payout'],
            'fx_effective_rate_merchant_to_payout' => $quote['effective_rate_merchant_to_payout'],
            'fx_spread_bps' => $quote['fx_spread_bps'],
            'fx_spread_amount' => $quote['fx_spread_amount'],
            'fx_spread_currency_code' => $quote['fx_spread_currency_code'],
            'fx_rate_date' => $moneySnapshot['fx_rate_date'],
            'merchant_amount' => $moneySnapshot['merchant_amount'],
            'payout_amount' => $quote['payout_amount'],
            'payout_snapshot' => [
                'method' => $method,
                'payout_channel_key' => $channel['key'],
                'payout_channel_label' => $channel['label'],
                'payout_provider' => $channel['provider'],
                'payment_provider_id' => $channel['provider_id'] ?? null,
                'payment_provider_channel_id' => $channel['id'] ?? null,
                'merchant_payout_credential_id' => $request->input('merchant_payout_credential_id') ?: null,
                'requested_payout_currency_code' => $request->input('payout_currency_code'),
                'merchant_country_code' => $merchant->country?->iso_alpha2,
                'market_rate_merchant_to_payout' => $quote['market_rate_merchant_to_payout'],
                'effective_rate_merchant_to_payout' => $quote['effective_rate_merchant_to_payout'],
                'payout_gross_amount' => $quote['payout_gross_amount'],
                'fx_spread_bps' => $quote['fx_spread_bps'],
                'fx_spread_amount' => $quote['fx_spread_amount'],
                'fx_spread_currency_code' => $quote['fx_spread_currency_code'],
                'fx_margin_bps' => $quote['fx_margin_bps'],
                'fx_margin_amount' => $quote['fx_margin_amount'],
                'fee_type' => $quote['fee_type'],
                'fee_fixed' => $quote['fee_fixed'],
                'fee_percent_bps' => $quote['fee_percent_bps'],
                'fee_min' => $quote['fee_min'],
                'fee_max' => $quote['fee_max'],
                'withdrawal_fee_amount' => $quote['withdrawal_fee_amount'],
                'withdrawal_fee_currency_code' => $quote['withdrawal_fee_currency_code'],
                'quote_note' => $quote['note'],
                'created_at' => now()->toISOString(),
            ],
            'money_quote_snapshot' => $moneySnapshot['money_quote_snapshot'] ?? null,
            'status' => 'pending',
            'idempotency_key' => Str::uuid(),
        ]);

        return redirect()->back()->with('success', 'Ombi lako limepokelewa na linafanyiwa kazi. (Withdrawal requested successfully)');
    }

    private function withdrawalQuotePayload(array $moneySnapshot, array $channel): array
    {
        $method = strtolower((string) ($channel['method'] ?? 'bank'));
        $merchantAmount = (float) $moneySnapshot['merchant_amount'];
        $payoutGrossAmount = (float) ($moneySnapshot['market_customer_amount'] ?? $moneySnapshot['customer_amount']);
        $marketRate = (float) ($moneySnapshot['fx_market_rate_merchant_to_customer'] ?? $moneySnapshot['fx_rate_merchant_to_customer']);
        $payoutCurrencyCode = (string) $moneySnapshot['customer_currency_code'];
        $marginBps = (int) ($moneySnapshot['fx_spread_bps'] ?? 0);
        $marginAmount = (float) ($moneySnapshot['fx_spread_amount'] ?? 0);
        $feeBaseAmount = max((float) ($moneySnapshot['customer_amount'] ?? $payoutGrossAmount), 0);
        $effectiveRate = (float) ($moneySnapshot['fx_effective_rate_merchant_to_customer'] ?? ($merchantAmount > 0 ? round($feeBaseAmount / $merchantAmount, 10) : $marketRate));
        $withdrawalFeeAmount = $this->withdrawalFeeAmountForChannel($channel, $feeBaseAmount, $effectiveRate);
        $payoutAmount = max(round($feeBaseAmount - $withdrawalFeeAmount, 2), 0);
        $feeType = (string) ($channel['fee_type'] ?? 'fixed_plus_percent');

        return [
            'merchant_amount' => $merchantAmount,
            'merchant_currency_code' => $moneySnapshot['merchant_currency_code'],
            'payout_channel_key' => $channel['key'] ?? null,
            'payout_channel_label' => $channel['label'] ?? null,
            'payout_provider' => $channel['provider'] ?? null,
            'payout_method' => $method,
            'payout_currency_code' => $payoutCurrencyCode,
            'payout_gross_amount' => $payoutGrossAmount,
            'payout_amount' => $payoutAmount,
            'market_rate_merchant_to_payout' => $marketRate,
            'effective_rate_merchant_to_payout' => $effectiveRate,
            'fx_spread_bps' => $marginBps,
            'fx_spread_amount' => $marginAmount,
            'fx_spread_currency_code' => $payoutCurrencyCode,
            'fx_margin_bps' => $marginBps,
            'fx_margin_amount' => $marginAmount,
            'fee_type' => $feeType,
            'fee_fixed' => (float) ($channel['fee_fixed'] ?? 0),
            'fee_percent_bps' => (int) ($channel['fee_percent_bps'] ?? 0),
            'fee_min' => (float) ($channel['fee_min'] ?? 0),
            'fee_max' => $channel['fee_max'] ?? null,
            'withdrawal_fee_amount' => $withdrawalFeeAmount,
            'withdrawal_fee_currency_code' => $payoutCurrencyCode,
            'fx_rate_date' => $moneySnapshot['fx_rate_date'],
            'is_estimate' => true,
            'note' => $method === 'paypal'
                ? 'The payout partner may apply its own FX spread or final rate when the payout is processed.'
                : 'Final payout can change if the payout channel charges a fee or applies its own FX rate.',
        ];
    }

    private function withdrawalLimitError(float $amount, string $currencyCode, array $channel): ?string
    {
        $limits = is_array($channel['limits'] ?? null) ? $channel['limits'] : [];
        $minimum = $this->positiveLimitAmount($limits['min_withdrawal_amount'] ?? null);
        $maximum = $this->positiveLimitAmount($limits['max_withdrawal_amount'] ?? null);

        if ($minimum !== null && $amount < $minimum) {
            return 'Kima cha chini cha kutoa kupitia ' . $this->publicPayoutChannelLabel($channel) . ' ni ' . $this->formatLimitMoney($minimum, $currencyCode) . '.';
        }

        if ($maximum !== null && $amount > $maximum) {
            return 'Kiasi cha juu cha kutoa kupitia ' . $this->publicPayoutChannelLabel($channel) . ' ni ' . $this->formatLimitMoney($maximum, $currencyCode) . '.';
        }

        return null;
    }

    private function publicPayoutChannelLabel(array $channel): string
    {
        return app(\App\Services\PaymentProviderCatalogService::class)->publicChannelLabel(
            (string) ($channel['method'] ?? 'bank'),
            (string) ($channel['direction'] ?? 'payout')
        );
    }

    private function positiveLimitAmount(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $amount = (float) $value;

        return $amount > 0 ? $amount : null;
    }

    private function formatLimitMoney(float $amount, string $currencyCode): string
    {
        $decimals = in_array(strtoupper($currencyCode), ['TZS', 'JPY', 'KRW'], true) ? 0 : 2;

        return strtoupper($currencyCode) . ' ' . number_format($amount, $decimals);
    }

    private function withdrawalFxMarginBps(string $method): int
    {
        $method = strtolower($method);
        $default = $method === 'paypal' ? 350 : 0;

        return max(0, (int) AdminSetting::get("withdrawal_fx_margin_bps_{$method}", AdminSetting::get('withdrawal_fx_margin_bps', $default)));
    }

    private function withdrawalFeeAmountForChannel(array $channel, float $payoutAmountAfterFx, float $merchantToPayoutRate): float
    {
        $feeType = (string) ($channel['fee_type'] ?? 'fixed_plus_percent');
        $fixed = max(0, (float) ($channel['fee_fixed'] ?? 0)) * max($merchantToPayoutRate, 0);
        $percentBps = max(0, min(10000, (int) ($channel['fee_percent_bps'] ?? 0)));

        $fee = match ($feeType) {
            'none' => 0,
            'fixed' => $fixed,
            'percent' => $payoutAmountAfterFx * ($percentBps / 10000),
            default => $fixed + ($payoutAmountAfterFx * ($percentBps / 10000)),
        };

        $fee = round(max(0, $fee), 2);
        $min = max(0, (float) ($channel['fee_min'] ?? 0)) * max($merchantToPayoutRate, 0);
        $max = $channel['fee_max'] ?? null;

        if ($fee > 0 && $min > 0) {
            $fee = max($fee, $min);
        }
        if ($max !== null && $max !== '' && (float) $max >= 0) {
            $fee = min($fee, (float) $max * max($merchantToPayoutRate, 0));
        }

        return round(min($fee, max(0, $payoutAmountAfterFx)), 2);
    }

    private function isKycApproved(?string $status): bool
    {
        $normalized = strtolower((string) $status);
        return in_array($normalized, ['approved', 'verified'], true);
    }

    private function resolvePayoutChannel(Merchant $merchant, mixed $requestedChannelKey, string $method, mixed $requestedCurrencyCode, mixed $credentialId = null): array
    {
        $method = strtolower($method);
        $merchantCurrencyCode = $merchant->currency?->code ?: 'TZS';
        $countryCurrencyCode = $merchant->country?->defaultCurrency?->code ?: $merchantCurrencyCode;
        $requestedCurrencyCode = strtoupper((string) ($requestedCurrencyCode ?: ''));
        $requestedChannelKey = strtolower((string) ($requestedChannelKey ?: ''));

        $routedChannel = app(PaymentChannelRouter::class)->resolvePayoutChannel(
            merchant: $merchant,
            channelKey: $requestedChannelKey ?: null,
            method: $method ?: null,
            currencyCode: $requestedCurrencyCode ?: null,
            credentialId: $credentialId ? (int) $credentialId : null,
        );

        if ($routedChannel) {
            $payload = app(\App\Services\PaymentProviderCatalogService::class)->channelToArray($routedChannel);
            if ($requestedCurrencyCode !== '' && in_array($requestedCurrencyCode, $payload['currencies'] ?: [], true)) {
                $payload['currency_code'] = $requestedCurrencyCode;
            }
            $payload['label'] = $this->publicPayoutChannelLabel($payload);
            $payload['name'] = $payload['label'];

            return $payload;
        }

        $channels = collect($this->payoutChannelsForMerchant($merchant));

        $channel = $requestedChannelKey !== ''
            ? $channels->first(fn ($item) => strtolower((string) $item['key']) === $requestedChannelKey)
            : null;

        if (! $channel) {
            $channel = $channels->first(function ($item) use ($method, $requestedCurrencyCode) {
                if (strtolower((string) $item['method']) !== $method) {
                    return false;
                }

                return $requestedCurrencyCode === '' || strtoupper((string) $item['currency_code']) === $requestedCurrencyCode;
            });
        }

        if (! $channel) {
            $channel = $channels->first();
        }

        if (! $channel) {
            $channel = $this->normalizePayoutChannel([
                'key' => 'fallback_bank_' . strtolower($countryCurrencyCode),
                'label' => 'Bank transfer',
                'country_code' => $merchant->country?->iso_alpha2 ?: '*',
                'provider' => 'manual',
                'method' => $method ?: 'bank',
                'currency_code' => $countryCurrencyCode,
            ]);
        }

        $channel['label'] = $this->publicPayoutChannelLabel($channel);
        $channel['name'] = $channel['label'];

        return $channel;
    }

    private function payoutCurrencyOptions(Merchant $merchant): array
    {
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);

        return collect($this->payoutChannelsForMerchant($merchant))
            ->flatMap(fn (array $channel) => $channel['currencies'] ?? [$channel['currency_code'] ?? null])
            ->filter()
            ->unique()
            ->map(function ($code) use ($merchant) {
                $currency = \App\Models\Currency::query()->where('code', $code)->first();

                return [
                    'code' => $code,
                    'name' => $currency?->name,
                    'symbol' => $currency?->symbol,
                    'is_business_currency' => $code === ($merchant->currency?->code ?: 'TZS'),
                    'is_country_currency' => $code === ($merchant->country?->defaultCurrency?->code),
                ];
            })
            ->values()
            ->all();
    }

    private function payoutChannelsForMerchant(Merchant $merchant): array
    {
        $merchant->loadMissing(['currency', 'country.defaultCurrency']);
        $routed = app(PaymentChannelRouter::class)->payoutChannelsForMerchant($merchant);
        if (! empty($routed)) {
            return $routed;
        }

        $countryCode = strtoupper((string) ($merchant->country?->iso_alpha2 ?: '*'));
        $channels = collect($this->configuredPayoutChannels())
            ->map(fn (array $channel) => $this->normalizePayoutChannel($channel))
            ->filter(fn (array $channel) => (bool) $channel['enabled'])
            ->filter(fn (array $channel) => in_array($channel['country_code'], [$countryCode, '*'], true))
            ->map(function (array $channel) {
                $channel['label'] = $this->publicPayoutChannelLabel($channel);
                $channel['name'] = $channel['label'];

                return $channel;
            })
            ->values();

        if ($channels->isEmpty()) {
            $channels = collect($this->fallbackPayoutChannelsForMerchant($merchant));
        }

        return $channels->values()->all();
    }

    private function configuredPayoutChannels(): array
    {
        $raw = AdminSetting::get('withdrawal_payout_channels', null);
        $channels = is_string($raw) ? json_decode($raw, true) : $raw;

        return is_array($channels) ? $channels : [];
    }

    private function fallbackPayoutChannelsForMerchant(Merchant $merchant): array
    {
        $countryCode = strtoupper((string) ($merchant->country?->iso_alpha2 ?: 'TZ'));
        $currencyCode = strtoupper((string) ($merchant->country?->defaultCurrency?->code ?: $merchant->currency?->code ?: 'TZS'));
        $provider = $countryCode === 'TZ' ? 'selcom' : 'manual';

        return [
            $this->normalizePayoutChannel([
                'key' => strtolower("{$countryCode}_{$provider}_mobile_money_{$currencyCode}"),
                'label' => 'Mobile money',
                'country_code' => $countryCode,
                'provider' => $provider,
                'method' => 'mobile_money',
                'currency_code' => $currencyCode,
            ]),
            $this->normalizePayoutChannel([
                'key' => strtolower("{$countryCode}_{$provider}_bank_{$currencyCode}"),
                'label' => 'Bank transfer',
                'country_code' => $countryCode,
                'provider' => $provider,
                'method' => 'bank',
                'currency_code' => $currencyCode,
            ]),
        ];
    }

    private function normalizePayoutChannel(array $channel): array
    {
        $countryCode = strtoupper(substr((string) ($channel['country_code'] ?? '*'), 0, 2)) ?: '*';
        $provider = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', (string) ($channel['provider'] ?? 'manual'))) ?: 'manual';
        $method = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', (string) ($channel['method'] ?? 'bank'))) ?: 'bank';
        $currencyCode = strtoupper(substr((string) ($channel['currency_code'] ?? 'TZS'), 0, 3));
        $key = strtolower(preg_replace('/[^a-z0-9_]+/i', '_', (string) ($channel['key'] ?? '')));
        $feeType = (string) ($channel['fee_type'] ?? 'fixed_plus_percent');

        if (! in_array($feeType, ['none', 'fixed', 'percent', 'fixed_plus_percent'], true)) {
            $feeType = 'fixed_plus_percent';
        }
        if ($key === '' || $key === '_') {
            $key = strtolower(trim("{$countryCode}_{$provider}_{$method}_{$currencyCode}", '_'));
        }

        return [
            'key' => $key,
            'label' => trim((string) ($channel['label'] ?? 'Payout channel')) ?: 'Payout channel',
            'country_code' => $countryCode,
            'provider' => $provider,
            'method' => $method,
            'currency_code' => $currencyCode,
            'enabled' => filter_var($channel['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'fx_margin_bps' => max(0, min(5000, (int) ($channel['fx_margin_bps'] ?? 0))),
            'fee_type' => $feeType,
            'fee_fixed' => max(0, round((float) ($channel['fee_fixed'] ?? 0), 2)),
            'fee_percent_bps' => max(0, min(10000, (int) ($channel['fee_percent_bps'] ?? 0))),
            'fee_min' => max(0, round((float) ($channel['fee_min'] ?? 0), 2)),
            'fee_max' => ($channel['fee_max'] ?? null) === '' ? null : ($channel['fee_max'] ?? null),
        ];
    }
}
