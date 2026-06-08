<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\Currency;
use App\Models\FeePolicy;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\FeePolicyService;
use App\Services\WithdrawalAccountingService;
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
