<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\Currency;
use App\Models\FeePolicy;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\PaymentProvider;
use App\Models\PaymentProviderChannel;
use App\Models\ProviderTreasuryAccount;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
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
        $country = Country::create([
            'name' => 'Tanzania',
            'iso_alpha2' => 'TZ',
            'default_currency_id' => $this->currency('TZS')->id,
            'is_active' => true,
        ]);
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
        $provider = PaymentProvider::create([
            'key' => 'selcom',
            'name' => 'Selcom',
            'driver' => 'selcom',
            'status' => 'enabled',
        ]);

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
