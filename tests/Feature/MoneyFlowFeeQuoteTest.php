<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\Currency;
use App\Models\AdminSetting;
use App\Models\FeePolicy;
use App\Models\Merchant;
use App\Models\MerchantPayoutCredential;
use App\Models\Order;
use App\Models\PaymentProvider;
use App\Models\PaymentProviderChannel;
use App\Models\Product;
use App\Models\ProviderTreasuryAccount;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Payments\PaymentCallbackProcessor;
use App\Services\FeePolicyService;
use App\Services\ProviderTreasuryService;
use App\Services\WithdrawalAccountingService;
use App\Services\WithdrawalFailureRecoveryService;
use App\Services\WithdrawalQuoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MoneyFlowFeeQuoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_same_currency_withdrawal_keeps_payout_whole_and_adds_provider_cost_to_wallet_debit(): void
    {
        $merchant = $this->merchant('TZS');

        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10000, $this->payoutChannel([
            'fee_fixed' => 500,
        ]));

        $this->assertSame(10000.0, $quote['merchant_principal_amount']);
        $this->assertSame(10000.0, $quote['payout_amount']);
        $this->assertSame(500.0, $quote['provider_cost_amount']);
        $this->assertSame(500.0, $quote['merchant_fee_amount']);
        $this->assertSame(10500.0, $quote['wallet_debit_amount']);
        $this->assertSame(0.0, $quote['takeer_margin_amount']);
    }

    public function test_cross_currency_withdrawal_converts_provider_cost_back_to_wallet_currency(): void
    {
        $merchant = $this->merchant('USD');

        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10, $this->payoutChannel([
            'currency_code' => 'TZS',
            'fee_fixed' => 500,
        ]));

        $this->assertSame(10.0, $quote['merchant_principal_amount']);
        $this->assertSame(25000.0, $quote['payout_amount']);
        $this->assertSame(500.0, $quote['provider_cost_amount']);
        $this->assertSame(0.2, $quote['provider_cost_merchant_amount']);
        $this->assertSame(10.2, $quote['wallet_debit_amount']);
    }

    public function test_withdrawal_quote_adds_admin_markup_on_top_of_provider_cost(): void
    {
        $merchant = $this->merchant('USD');

        FeePolicy::create([
            'name' => 'USD withdrawal markup',
            'category' => 'withdrawal',
            'scope' => 'currency',
            'currency_code' => 'USD',
            'fee_type' => 'fixed',
            'fixed_amount' => 1,
            'fixed_fee_currency_code' => 'USD',
            'percentage_rate' => 0,
            'is_active' => true,
        ]);

        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10, $this->payoutChannel([
            'currency_code' => 'TZS',
            'fee_fixed' => 500,
        ]));

        $this->assertSame(10.0, $quote['merchant_principal_amount']);
        $this->assertSame(25000.0, $quote['payout_amount']);
        $this->assertSame(0.2, $quote['provider_cost_merchant_amount']);
        $this->assertSame(1.0, $quote['takeer_markup_amount']);
        $this->assertSame(1.0, $quote['takeer_margin_amount']);
        $this->assertSame(1.2, $quote['merchant_fee_amount']);
        $this->assertSame(11.2, $quote['wallet_debit_amount']);
    }

    public function test_withdrawal_quote_uses_provider_channel_key_for_channel_scoped_markup(): void
    {
        $merchant = $this->merchant('USD');

        FeePolicy::create([
            'name' => 'Selcom payout markup',
            'category' => 'withdrawal',
            'scope' => 'payment_channel',
            'payment_channel' => 'tz_selcom_payout_mobile_money_tzs',
            'fee_type' => 'fixed',
            'fixed_amount' => 2,
            'fixed_fee_currency_code' => 'USD',
            'percentage_rate' => 0,
            'is_active' => true,
        ]);

        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10, $this->payoutChannel([
            'key' => 'tz_selcom_payout_mobile_money_tzs',
            'currency_code' => 'TZS',
            'fee_fixed' => 500,
        ]));

        $this->assertSame(0.2, $quote['provider_cost_merchant_amount']);
        $this->assertSame(2.0, $quote['takeer_markup_amount']);
        $this->assertSame(2.2, $quote['merchant_fee_amount']);
        $this->assertSame(12.2, $quote['wallet_debit_amount']);
    }

    public function test_sale_fee_is_floored_to_provider_payin_cost_when_policy_fee_is_too_low(): void
    {
        $merchant = $this->merchant('TZS');
        $order = $this->order($merchant, [
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_channel_snapshot' => [
                'fee_type' => 'fixed',
                'fee_fixed' => 700,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
            ],
        ]);

        $fee = app(FeePolicyService::class)->calculateForOrder($order, 10000);

        $this->assertSame(700.0, $fee['fee_amount']);
        $this->assertSame(9300.0, $fee['net_amount']);
        $this->assertSame(700.0, $fee['snapshot']['provider_cost_amount']);
        $this->assertSame(0.0, $fee['snapshot']['takeer_margin_amount']);
        $this->assertTrue($fee['snapshot']['provider_cost_floor_applied']);
    }

    public function test_sale_fee_uses_provider_channel_key_from_order_snapshot(): void
    {
        $merchant = $this->merchant('TZS');

        FeePolicy::create([
            'name' => 'Selcom checkout sale fee',
            'category' => 'sale',
            'scope' => 'payment_channel',
            'payment_channel' => 'tz_selcom_payin_mobile_money_tzs',
            'fee_type' => 'fixed',
            'fixed_amount' => 900,
            'fixed_fee_currency_code' => 'TZS',
            'percentage_rate' => 0,
            'is_active' => true,
        ]);

        $order = $this->order($merchant, [
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_channel_snapshot' => [
                'payment_provider_channel_key' => 'tz_selcom_payin_mobile_money_tzs',
                'fee_type' => 'fixed',
                'fee_fixed' => 100,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
            ],
        ]);

        $fee = app(FeePolicyService::class)->calculateForOrder($order, 10000);

        $this->assertSame(900.0, $fee['fee_amount']);
        $this->assertSame(100.0, $fee['snapshot']['provider_cost_amount']);
        $this->assertSame(800.0, $fee['snapshot']['takeer_margin_amount']);
        $this->assertSame('tz_selcom_payin_mobile_money_tzs', $fee['snapshot']['fee_payment_channel']);
    }

    public function test_sale_fee_tracks_margin_when_policy_fee_exceeds_provider_cost(): void
    {
        $merchant = $this->merchant('TZS');
        $order = $this->order($merchant, [
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_channel_snapshot' => [
                'fee_type' => 'fixed',
                'fee_fixed' => 100,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
            ],
        ]);

        $fee = app(FeePolicyService::class)->calculateForOrder($order, 10000);

        $this->assertSame(500.0, $fee['fee_amount']);
        $this->assertSame(9500.0, $fee['net_amount']);
        $this->assertSame(100.0, $fee['snapshot']['provider_cost_amount']);
        $this->assertSame(400.0, $fee['snapshot']['takeer_margin_amount']);
        $this->assertFalse($fee['snapshot']['provider_cost_floor_applied']);
    }

    public function test_sale_fee_can_be_scoped_by_sellable_type(): void
    {
        $merchant = $this->merchant('TZS');

        FeePolicy::create([
            'name' => 'Digital download sale fee',
            'category' => 'sale',
            'scope' => 'sellable_type',
            'sellable_type' => 'digital',
            'fee_type' => 'percentage',
            'percentage_rate' => 30,
            'fixed_amount' => 0,
            'is_active' => true,
        ]);

        FeePolicy::create([
            'name' => 'Physical product sale fee',
            'category' => 'sale',
            'scope' => 'sellable_type',
            'sellable_type' => 'physical',
            'fee_type' => 'percentage',
            'percentage_rate' => 4,
            'fixed_amount' => 0,
            'is_active' => true,
        ]);

        $digitalOrder = $this->order($merchant, [
            'product_id' => $this->product($merchant, 'digital')->id,
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
        ]);
        $physicalOrder = $this->order($merchant, [
            'product_id' => $this->product($merchant, 'physical')->id,
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
        ]);

        $digitalFee = app(FeePolicyService::class)->calculateForOrder($digitalOrder, 10000);
        $physicalFee = app(FeePolicyService::class)->calculateForOrder($physicalOrder, 10000);

        $this->assertSame(3000.0, $digitalFee['fee_amount']);
        $this->assertSame(7000.0, $digitalFee['net_amount']);
        $this->assertSame('digital', $digitalFee['snapshot']['fee_sellable_type']);
        $this->assertSame('Digital download sale fee', $digitalFee['snapshot']['fee_policy_name']);

        $this->assertSame(400.0, $physicalFee['fee_amount']);
        $this->assertSame(9600.0, $physicalFee['net_amount']);
        $this->assertSame('physical', $physicalFee['snapshot']['fee_sellable_type']);
        $this->assertSame('Physical product sale fee', $physicalFee['snapshot']['fee_policy_name']);
    }

    public function test_sellable_type_sale_policy_wins_over_generic_payment_channel_policy(): void
    {
        $merchant = $this->merchant('TZS');

        FeePolicy::create([
            'name' => 'Generic channel sale fee',
            'category' => 'sale',
            'scope' => 'payment_channel',
            'payment_channel' => 'tz_selcom_payin_mobile_money_tzs',
            'fee_type' => 'percentage',
            'percentage_rate' => 8,
            'fixed_amount' => 0,
            'is_active' => true,
        ]);

        FeePolicy::create([
            'name' => 'Digital download sale fee',
            'category' => 'sale',
            'scope' => 'sellable_type',
            'sellable_type' => 'digital',
            'fee_type' => 'percentage',
            'percentage_rate' => 30,
            'fixed_amount' => 0,
            'is_active' => true,
        ]);

        $order = $this->order($merchant, [
            'product_id' => $this->product($merchant, 'digital')->id,
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_channel_snapshot' => [
                'payment_provider_channel_key' => 'tz_selcom_payin_mobile_money_tzs',
                'fee_type' => 'fixed',
                'fee_fixed' => 100,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
            ],
        ]);

        $fee = app(FeePolicyService::class)->calculateForOrder($order, 10000);

        $this->assertSame(3000.0, $fee['fee_amount']);
        $this->assertSame('Digital download sale fee', $fee['snapshot']['fee_policy_name']);
        $this->assertSame('tz_selcom_payin_mobile_money_tzs', $fee['snapshot']['fee_payment_channel']);
        $this->assertSame('digital', $fee['snapshot']['fee_sellable_type']);
    }

    public function test_automatic_withdrawal_policy_records_sale_fee_and_withdrawal_request(): void
    {
        $merchant = $this->merchant('TZS');
        AdminSetting::updateOrCreate(
            ['key' => 'payment_release_policy_digital_downloads'],
            ['value' => 'automatic_release']
        );
        AdminSetting::updateOrCreate(
            ['key' => 'payment_withdrawal_policy_digital_downloads'],
            ['value' => 'automatic_withdrawal']
        );
        $product = $this->product($merchant, 'digital');
        $provider = PaymentProvider::create([
            'key' => 'manual_gateway',
            'name' => 'Manual Gateway',
            'driver' => 'manual',
            'status' => 'enabled',
        ]);
        $channel = $this->providerPayoutChannel([
            'payment_provider_id' => $provider->id,
            'key' => 'tz_manual_payout_mobile_money_tzs',
        ]);

        ProviderTreasuryAccount::create([
            'payment_provider_id' => $channel->payment_provider_id,
            'payment_provider_channel_id' => $channel->id,
            'provider_key' => 'manual_gateway',
            'provider_channel_key' => $channel->key,
            'country_code' => 'TZ',
            'method' => 'mobile_money',
            'currency_code' => 'TZS',
            'balance_amount' => 100000,
            'reserved_amount' => 0,
            'minimum_available_amount' => 0,
            'status' => 'active',
        ]);

        MerchantPayoutCredential::create([
            'merchant_id' => $merchant->id,
            'payment_provider_channel_id' => $channel->id,
            'label' => 'Default mobile money',
            'method' => 'mobile_money',
            'network' => 'yas',
            'currency_code' => 'TZS',
            'details_encrypted' => ['phone_number' => '255700000001'],
            'details_masked' => ['network' => 'yas', 'phone_number' => '****0001', 'name' => 'TZS Merchant'],
            'verification_status' => 'verified',
            'verified_at' => now(),
            'is_default' => true,
            'status' => 'active',
        ]);

        Wallet::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'balance' => 10000,
            'frozen_balance' => 0,
        ]);

        $order = $this->order($merchant, [
            'product_id' => $product->id,
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_status' => 'pending',
        ]);

        app(PaymentCallbackProcessor::class)->handleSuccess($order, 'PAYIN-REF-1', 'test_gateway');

        $order->refresh();
        $this->assertSame('resolved_merchant_paid', $order->payment_status);

        $saleTransaction = Transaction::query()
            ->where('order_id', $order->id)
            ->where('type', 'order_revenue')
            ->firstOrFail();

        $this->assertSame(10000.0, (float) $saleTransaction->gross_amount);
        $this->assertGreaterThan(0, (float) $saleTransaction->fee_amount);
        $this->assertSame(
            round((float) $saleTransaction->gross_amount - (float) $saleTransaction->fee_amount, 2),
            (float) $saleTransaction->net_amount
        );

        $withdrawal = WithdrawalRequest::query()
            ->where('merchant_id', $merchant->id)
            ->where('idempotency_key', 'AUTO-WITHDRAWAL-ORDER-' . $order->id)
            ->firstOrFail();

        $this->assertSame('pending', $withdrawal->status);
        $this->assertGreaterThanOrEqual((float) $saleTransaction->net_amount, (float) $withdrawal->amount);
        $this->assertTrue((bool) $withdrawal->payout_snapshot['automatic_withdrawal']);
        $this->assertSame($order->id, $withdrawal->payout_snapshot['order_id']);
        $this->assertSame(round(10000 + (float) $saleTransaction->net_amount, 2), (float) $withdrawal->payout_snapshot['wallet_balance_before_auto_withdrawal']);
        $this->assertSame((float) $withdrawal->amount, (float) $withdrawal->payout_snapshot['wallet_debit_amount']);
        $this->assertSame((float) $withdrawal->merchant_amount, (float) $withdrawal->payout_snapshot['merchant_principal_amount']);
        $this->assertSame('automatic_withdrawal', $withdrawal->payout_snapshot['withdrawal_policy']['mode']);
        $this->assertSame(
            round(10000 + (float) $saleTransaction->net_amount - (float) $withdrawal->amount, 2),
            (float) $merchant->wallet()->first()->fresh()->balance
        );
    }

    public function test_automatic_release_with_manual_withdrawal_keeps_funds_in_wallet_without_withdrawal_request(): void
    {
        $merchant = $this->merchant('TZS');
        AdminSetting::updateOrCreate(
            ['key' => 'payment_release_policy_digital_downloads'],
            ['value' => 'automatic_release']
        );
        AdminSetting::updateOrCreate(
            ['key' => 'payment_withdrawal_policy_digital_downloads'],
            ['value' => 'manual_withdrawal']
        );

        $order = $this->order($merchant, [
            'product_id' => $this->product($merchant, 'digital')->id,
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_status' => 'pending',
        ]);

        app(PaymentCallbackProcessor::class)->handleSuccess($order, 'PAYIN-REF-MANUAL-WITHDRAWAL', 'test_gateway');

        $order->refresh();
        $this->assertSame('resolved_merchant_paid', $order->payment_status);

        $saleTransaction = Transaction::query()
            ->where('order_id', $order->id)
            ->where('type', 'order_revenue')
            ->firstOrFail();

        $this->assertSame((float) $saleTransaction->net_amount, (float) $merchant->wallet()->first()->fresh()->balance);
        $this->assertFalse(WithdrawalRequest::query()->where('merchant_id', $merchant->id)->where('payout_snapshot->order_id', $order->id)->exists());
    }

    public function test_automatic_withdrawal_waits_in_wallet_until_minimum_withdrawal_limit_is_met(): void
    {
        $merchant = $this->merchant('TZS');
        AdminSetting::updateOrCreate(
            ['key' => 'payment_release_policy_digital_downloads'],
            ['value' => 'automatic_release']
        );
        AdminSetting::updateOrCreate(
            ['key' => 'payment_withdrawal_policy_digital_downloads'],
            ['value' => 'automatic_withdrawal']
        );

        $this->automaticWithdrawalRoute($merchant, [
            'limits' => ['min_withdrawal_amount' => 10000, 'max_withdrawal_amount' => null],
        ]);

        $product = $this->product($merchant, 'digital');
        $firstOrder = $this->order($merchant, [
            'product_id' => $product->id,
            'total_paid' => 8000,
            'customer_total_amount' => 8000,
            'payment_status' => 'pending',
        ]);

        app(PaymentCallbackProcessor::class)->handleSuccess($firstOrder, 'PAYIN-BELOW-MIN', 'test_gateway');

        $firstSale = Transaction::query()
            ->where('order_id', $firstOrder->id)
            ->where('type', 'order_revenue')
            ->firstOrFail();

        $this->assertSame((float) $firstSale->net_amount, (float) $merchant->wallet()->first()->fresh()->balance);
        $this->assertSame(0, WithdrawalRequest::query()->where('merchant_id', $merchant->id)->count());

        $secondOrder = $this->order($merchant, [
            'product_id' => $product->id,
            'total_paid' => 8000,
            'customer_total_amount' => 8000,
            'payment_status' => 'pending',
        ]);

        app(PaymentCallbackProcessor::class)->handleSuccess($secondOrder, 'PAYIN-CROSSES-MIN', 'test_gateway');

        $secondSale = Transaction::query()
            ->where('order_id', $secondOrder->id)
            ->where('type', 'order_revenue')
            ->firstOrFail();
        $expectedWalletBalanceBeforeWithdrawal = round((float) $firstSale->net_amount + (float) $secondSale->net_amount, 2);

        $withdrawal = WithdrawalRequest::query()
            ->where('merchant_id', $merchant->id)
            ->where('idempotency_key', 'AUTO-WITHDRAWAL-ORDER-' . $secondOrder->id)
            ->firstOrFail();

        $this->assertSame($expectedWalletBalanceBeforeWithdrawal, (float) $withdrawal->payout_snapshot['wallet_balance_before_auto_withdrawal']);
        $this->assertSame($expectedWalletBalanceBeforeWithdrawal, (float) $withdrawal->amount);
        $this->assertSame((float) $withdrawal->merchant_amount, (float) $withdrawal->payout_snapshot['merchant_principal_amount']);
        $this->assertLessThanOrEqual(0.01, (float) $merchant->wallet()->first()->fresh()->balance);
        $this->assertSame(1, WithdrawalRequest::query()->where('merchant_id', $merchant->id)->count());
    }

    public function test_automatic_withdrawal_requires_default_withdrawal_option_and_keeps_funds_in_wallet(): void
    {
        $merchant = $this->merchant('TZS');
        AdminSetting::updateOrCreate(
            ['key' => 'payment_release_policy_digital_downloads'],
            ['value' => 'automatic_release']
        );
        AdminSetting::updateOrCreate(
            ['key' => 'payment_withdrawal_policy_digital_downloads'],
            ['value' => 'automatic_withdrawal']
        );

        $this->automaticWithdrawalRoute($merchant, [], false);

        $order = $this->order($merchant, [
            'product_id' => $this->product($merchant, 'digital')->id,
            'total_paid' => 10000,
            'customer_total_amount' => 10000,
            'payment_status' => 'pending',
        ]);

        app(PaymentCallbackProcessor::class)->handleSuccess($order, 'PAYIN-NO-DEFAULT-WITHDRAWAL', 'test_gateway');

        $saleTransaction = Transaction::query()
            ->where('order_id', $order->id)
            ->where('type', 'order_revenue')
            ->firstOrFail();

        $this->assertSame((float) $saleTransaction->net_amount, (float) $merchant->wallet()->first()->fresh()->balance);
        $this->assertSame(0, WithdrawalRequest::query()->where('merchant_id', $merchant->id)->count());
    }

    public function test_withdrawal_accounting_records_provider_cost_and_takeer_margin_separately(): void
    {
        $merchant = $this->merchant('TZS');
        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10000, $this->payoutChannel([
            'fee_fixed' => 500,
        ]));

        $withdrawal = WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'mobile_money',
            'amount' => $quote['wallet_debit_amount'],
            'merchant_currency_code' => $quote['merchant_currency_code'],
            'payout_currency_code' => $quote['payout_currency_code'],
            'merchant_amount' => $quote['merchant_principal_amount'],
            'payout_amount' => $quote['payout_amount'],
            'payout_snapshot' => [
                'wallet_debit_amount' => $quote['wallet_debit_amount'],
                'merchant_principal_amount' => $quote['merchant_principal_amount'],
                'merchant_fee_amount' => $quote['merchant_fee_amount'],
                'merchant_fee_currency_code' => $quote['merchant_fee_currency_code'],
                'provider_cost_merchant_amount' => $quote['provider_cost_merchant_amount'],
                'takeer_margin_amount' => $quote['takeer_margin_amount'],
                'fee_policy_snapshot' => $quote['fee_policy_snapshot'],
            ],
            'status' => 'pending',
        ]);

        app(WithdrawalAccountingService::class)->recordSubmitted($withdrawal);
        app(WithdrawalAccountingService::class)->recordSubmitted($withdrawal);

        $this->assertDatabaseHas('transactions', [
            'type' => 'withdrawal',
            'gross_amount' => 10500,
            'fee_amount' => 500,
            'provider_cost_amount' => 500,
            'takeer_margin_amount' => 0,
            'net_amount' => 10000,
        ]);
        $this->assertSame(1, \App\Models\Transaction::where('type', 'withdrawal')->count());
    }

    public function test_provider_treasury_blocks_cross_currency_withdrawal_when_payout_liquidity_is_missing(): void
    {
        $merchant = $this->merchant('USD');
        $channel = $this->providerPayoutChannel(['currencies' => ['TZS']]);
        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10, $this->payoutChannel([
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'key' => $channel->key,
            'currency_code' => 'TZS',
            'fee_fixed' => 500,
        ]));

        $liquidity = app(ProviderTreasuryService::class)->quoteLiquidity($quote, [
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'currency_code' => 'TZS',
        ]);

        $this->assertFalse($liquidity['is_available']);
        $this->assertSame('missing_treasury_account', $liquidity['reason']);

        ProviderTreasuryAccount::create([
            'payment_provider_id' => $channel->payment_provider_id,
            'payment_provider_channel_id' => $channel->id,
            'provider_key' => 'selcom',
            'provider_channel_key' => $channel->key,
            'country_code' => 'TZ',
            'method' => 'mobile_money',
            'currency_code' => 'TZS',
            'balance_amount' => 25000,
            'reserved_amount' => 0,
            'status' => 'active',
        ]);

        $liquidity = app(ProviderTreasuryService::class)->quoteLiquidity($quote, [
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'currency_code' => 'TZS',
        ]);

        $this->assertFalse($liquidity['is_available']);
        $this->assertSame('insufficient_provider_liquidity', $liquidity['reason']);
        $this->assertSame(25500.0, $liquidity['required_amount']);
    }

    public function test_merchant_withdrawal_request_is_blocked_when_provider_liquidity_is_missing(): void
    {
        $merchant = $this->merchant('TZS');
        $merchant->update([
            'is_verified' => true,
            'kyc_status' => 'verified',
        ]);
        $channel = $this->providerPayoutChannel([
            'currencies' => ['TZS'],
            'fee_fixed' => 150,
        ]);
        Wallet::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'balance' => 20000,
            'frozen_balance' => 0,
        ]);

        $this->actingAs($merchant->user)
            ->withSession(['step_up_verified_at.merchant_wallet_withdrawal' => now()->timestamp])
            ->from("/merchant/{$merchant->username}/wallet")
            ->post("/merchant/{$merchant->username}/wallet/withdraw", [
                'amount' => 5000,
                'method' => 'mobile_money',
                'payout_channel_key' => $channel->key,
                'payout_currency_code' => 'TZS',
            ])
            ->assertRedirect("/merchant/{$merchant->username}/wallet")
            ->assertSessionHasErrors('amount');

        $this->assertSame(0, WithdrawalRequest::query()->count());
        $this->assertSame(20000.0, (float) $merchant->wallet()->first()->fresh()->balance);
    }

    public function test_provider_treasury_reserves_captures_and_releases_payout_liquidity(): void
    {
        $merchant = $this->merchant('USD');
        $channel = $this->providerPayoutChannel(['currencies' => ['TZS']]);
        $account = ProviderTreasuryAccount::create([
            'payment_provider_id' => $channel->payment_provider_id,
            'payment_provider_channel_id' => $channel->id,
            'provider_key' => 'selcom',
            'provider_channel_key' => $channel->key,
            'country_code' => 'TZ',
            'method' => 'mobile_money',
            'currency_code' => 'TZS',
            'balance_amount' => 30000,
            'reserved_amount' => 0,
            'status' => 'active',
        ]);
        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10, $this->payoutChannel([
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'key' => $channel->key,
            'currency_code' => 'TZS',
            'fee_fixed' => 500,
        ]));
        $withdrawal = WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'mobile_money',
            'amount' => $quote['wallet_debit_amount'],
            'merchant_currency_code' => $quote['merchant_currency_code'],
            'payout_currency_code' => $quote['payout_currency_code'],
            'merchant_amount' => $quote['merchant_principal_amount'],
            'payout_amount' => $quote['payout_amount'],
            'status' => 'pending',
        ]);

        app(ProviderTreasuryService::class)->reserveForWithdrawal($withdrawal, $quote, [
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'key' => $channel->key,
            'provider' => 'selcom',
            'method' => 'mobile_money',
            'currency_code' => 'TZS',
        ]);

        $this->assertSame(25500.0, (float) $account->fresh()->reserved_amount);
        $this->assertSame(4500.0, $account->fresh()->availableAmount());

        app(ProviderTreasuryService::class)->captureWithdrawal($withdrawal);

        $this->assertSame(4500.0, (float) $account->fresh()->balance_amount);
        $this->assertSame(0.0, (float) $account->fresh()->reserved_amount);
        $this->assertDatabaseHas('provider_treasury_reservations', [
            'withdrawal_request_id' => $withdrawal->id,
            'status' => 'captured',
            'amount' => 25500,
        ]);

        $second = WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'mobile_money',
            'amount' => 1,
            'merchant_currency_code' => 'USD',
            'payout_currency_code' => 'TZS',
            'merchant_amount' => 1,
            'payout_amount' => 1,
            'status' => 'pending',
        ]);
        $account->fresh()->update(['balance_amount' => 30000]);
        app(ProviderTreasuryService::class)->reserveForWithdrawal($second, $quote, [
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'currency_code' => 'TZS',
        ]);
        app(ProviderTreasuryService::class)->releaseWithdrawal($second);

        $this->assertSame(30000.0, (float) $account->fresh()->balance_amount);
        $this->assertSame(0.0, (float) $account->fresh()->reserved_amount);
        $this->assertDatabaseHas('provider_treasury_reservations', [
            'withdrawal_request_id' => $second->id,
            'status' => 'released',
        ]);
    }

    public function test_failed_withdrawal_releases_liquidity_and_refunds_wallet_debit_once(): void
    {
        $merchant = $this->merchant('USD');
        Wallet::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'balance' => 0,
            'frozen_balance' => 0,
        ]);
        $channel = $this->providerPayoutChannel(['currencies' => ['TZS']]);
        $account = ProviderTreasuryAccount::create([
            'payment_provider_id' => $channel->payment_provider_id,
            'payment_provider_channel_id' => $channel->id,
            'provider_key' => 'selcom',
            'provider_channel_key' => $channel->key,
            'country_code' => 'TZ',
            'method' => 'mobile_money',
            'currency_code' => 'TZS',
            'balance_amount' => 30000,
            'reserved_amount' => 0,
            'status' => 'active',
        ]);
        $quote = app(WithdrawalQuoteService::class)->quote($merchant, 10, $this->payoutChannel([
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'key' => $channel->key,
            'currency_code' => 'TZS',
            'fee_fixed' => 500,
        ]));
        $withdrawal = WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'mobile_money',
            'amount' => $quote['wallet_debit_amount'],
            'merchant_currency_code' => $quote['merchant_currency_code'],
            'payout_currency_code' => $quote['payout_currency_code'],
            'merchant_amount' => $quote['merchant_principal_amount'],
            'payout_amount' => $quote['payout_amount'],
            'payout_snapshot' => [
                'wallet_debit_amount' => $quote['wallet_debit_amount'],
            ],
            'status' => 'processing',
        ]);

        app(ProviderTreasuryService::class)->reserveForWithdrawal($withdrawal, $quote, [
            'id' => $channel->id,
            'provider_id' => $channel->payment_provider_id,
            'currency_code' => 'TZS',
        ]);
        app(ProviderTreasuryService::class)->releaseWithdrawal($withdrawal);
        app(WithdrawalFailureRecoveryService::class)->refundWalletDebit($withdrawal);
        app(WithdrawalFailureRecoveryService::class)->refundWalletDebit($withdrawal);

        $this->assertSame(30000.0, (float) $account->fresh()->balance_amount);
        $this->assertSame(0.0, (float) $account->fresh()->reserved_amount);
        $this->assertSame($quote['wallet_debit_amount'], (float) $merchant->wallet()->first()->balance);
        $this->assertNotEmpty($withdrawal->fresh()->payout_snapshot['wallet_refunded_at'] ?? null);
    }

    private function merchant(string $currencyCode): Merchant
    {
        $currency = $this->currency($currencyCode);
        $country = Country::firstOrCreate(
            ['iso_alpha2' => 'TZ'],
            [
                'name' => 'Tanzania',
                'default_currency_id' => $this->currency('TZS')->id,
                'is_active' => true,
            ]
        );
        $user = User::factory()->create(['role' => 'merchant']);

        return Merchant::create([
            'user_id' => $user->id,
            'username' => strtolower($currencyCode) . '-merchant',
            'display_name' => $currencyCode . ' Merchant',
            'type' => 'business',
            'country_id' => $country->id,
            'currency_id' => $currency->id,
            'is_default' => true,
            'is_active' => true,
        ]);
    }

    private function order(Merchant $merchant, array $attributes): Order
    {
        $buyer = User::factory()->create();

        return Order::create(array_merge([
            'buyer_id' => $buyer->id,
            'merchant_id' => $merchant->id,
            'quantity' => 1,
            'unit_price' => 10000,
            'total_paid' => 10000,
            'payment_status' => 'pending',
            'transaction_ref' => uniqid('test-', true),
            'merchant_currency_code' => 'TZS',
            'customer_currency_code' => 'TZS',
            'fx_base_currency_code' => 'USD',
            'fx_rate_merchant_to_base' => 2500,
            'fx_rate_customer_to_base' => 2500,
            'fx_rate_merchant_to_customer' => 1,
            'fx_effective_rate_merchant_to_customer' => 1,
            'fx_rate_date' => now()->toDateString(),
            'country_code' => 'TZ',
            'payment_gateway' => 'selcom',
        ], $attributes));
    }

    private function product(Merchant $merchant, string $type): Product
    {
        return Product::create([
            'merchant_id' => $merchant->id,
            'type' => $type,
            'title' => ucfirst($type).' test product',
            'price' => 10000,
            'inventory_count' => $type === 'physical' ? 10 : 0,
            'url' => $type === 'digital' ? 'private://digital-products/test.pdf' : null,
        ]);
    }

    private function payoutChannel(array $overrides = []): array
    {
        return array_merge([
            'key' => 'test_payout',
            'label' => 'Test payout',
            'provider' => 'selcom',
            'method' => 'mobile_money',
            'direction' => 'payout',
            'currency_code' => 'TZS',
            'fx_margin_bps' => 0,
            'fee_type' => 'fixed_plus_percent',
            'fee_fixed' => 0,
            'fee_percent_bps' => 0,
            'fee_min' => 0,
            'fee_max' => null,
            'limits' => [],
        ], $overrides);
    }

    private function providerPayoutChannel(array $overrides = []): PaymentProviderChannel
    {
        $provider = PaymentProvider::firstOrCreate(
            ['key' => 'selcom'],
            [
                'name' => 'Selcom',
                'driver' => 'selcom',
                'status' => 'enabled',
            ]
        );

        return PaymentProviderChannel::create(array_merge([
            'payment_provider_id' => $provider->id,
            'key' => 'tz_selcom_payout_mobile_money_tzs',
            'country_code' => 'TZ',
            'direction' => 'payout',
            'method' => 'mobile_money',
            'name' => 'Selcom Mobile Money',
            'currencies' => ['TZS'],
            'status' => 'enabled',
            'priority' => 10,
            'fee_type' => 'fixed_plus_percent',
            'fee_fixed' => 0,
            'fee_percent_bps' => 0,
            'fee_min' => 0,
            'fee_max' => null,
            'fx_margin_bps' => 0,
        ], $overrides));
    }

    private function automaticWithdrawalRoute(Merchant $merchant, array $channelOverrides = [], bool $isDefaultCredential = true): MerchantPayoutCredential
    {
        $channel = $this->providerPayoutChannel(array_merge([
            'key' => 'tz_test_auto_payout_mobile_money_tzs_' . uniqid(),
        ], $channelOverrides));

        ProviderTreasuryAccount::create([
            'payment_provider_id' => $channel->payment_provider_id,
            'payment_provider_channel_id' => $channel->id,
            'provider_key' => $channel->provider?->key ?: 'selcom',
            'provider_channel_key' => $channel->key,
            'country_code' => 'TZ',
            'method' => 'mobile_money',
            'currency_code' => 'TZS',
            'balance_amount' => 100000,
            'reserved_amount' => 0,
            'minimum_available_amount' => 0,
            'status' => 'active',
        ]);

        return MerchantPayoutCredential::create([
            'merchant_id' => $merchant->id,
            'payment_provider_channel_id' => $channel->id,
            'label' => 'Auto mobile money',
            'method' => 'mobile_money',
            'network' => 'yas',
            'currency_code' => 'TZS',
            'details_encrypted' => ['phone_number' => '255700000001'],
            'details_masked' => ['network' => 'yas', 'phone_number' => '****0001', 'name' => 'TZS Merchant'],
            'verification_status' => 'verified',
            'verified_at' => now(),
            'is_default' => $isDefaultCredential,
            'status' => 'active',
        ]);
    }

    private function currency(string $code): Currency
    {
        return Currency::firstOrCreate(
            ['code' => $code],
            [
                'name' => $code,
                'symbol' => $code,
                'symbol_position' => 'prefix',
                'exchange_rate' => $code === 'USD' ? 1 : 2500,
                'is_base_currency' => $code === 'USD',
                'is_active' => true,
            ]
        );
    }
}
