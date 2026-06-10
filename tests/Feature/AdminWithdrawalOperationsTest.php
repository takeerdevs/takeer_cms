<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\Currency;
use App\Models\Merchant;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminWithdrawalOperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_withdrawal_approval_is_claimed_once(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = $this->merchant();
        $withdrawal = WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'manual',
            'amount' => 10500,
            'merchant_currency_code' => 'TZS',
            'payout_currency_code' => 'TZS',
            'merchant_amount' => 10000,
            'payout_amount' => 10000,
            'payout_snapshot' => [
                'method' => 'manual',
                'wallet_debit_amount' => 10500,
                'merchant_principal_amount' => 10000,
                'merchant_fee_amount' => 500,
                'merchant_fee_currency_code' => 'TZS',
                'provider_cost_merchant_amount' => 500,
                'takeer_margin_amount' => 0,
                'fee_policy_snapshot' => [],
            ],
            'status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->postJson("/admin/api/withdrawals/{$withdrawal->id}/approve")
            ->assertOk();

        $this->actingAs($admin)
            ->postJson("/admin/api/withdrawals/{$withdrawal->id}/approve")
            ->assertStatus(400)
            ->assertJsonPath('message', 'This withdrawal request has already been handled.');

        $this->assertSame('approved', $withdrawal->fresh()->status);
        $this->assertSame(1, \App\Models\Transaction::query()->where('type', 'withdrawal')->count());
    }

    public function test_admin_withdrawals_can_be_filtered_by_status(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = $this->merchant();
        WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'manual',
            'amount' => 10000,
            'merchant_currency_code' => 'TZS',
            'payout_currency_code' => 'TZS',
            'merchant_amount' => 10000,
            'payout_amount' => 10000,
            'status' => 'pending',
        ]);
        WithdrawalRequest::create([
            'user_id' => $merchant->user_id,
            'merchant_id' => $merchant->id,
            'method' => 'manual',
            'amount' => 20000,
            'merchant_currency_code' => 'TZS',
            'payout_currency_code' => 'TZS',
            'merchant_amount' => 20000,
            'payout_amount' => 20000,
            'status' => 'processing',
        ]);

        $this->actingAs($admin)
            ->getJson('/admin/api/withdrawals?status=processing')
            ->assertOk()
            ->assertJsonCount(1, 'withdrawals')
            ->assertJsonPath('withdrawals.0.status', 'processing')
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('pagination.current_page', 1);
    }

    public function test_admin_withdrawals_are_paginated(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = $this->merchant();

        foreach (range(1, 25) as $index) {
            WithdrawalRequest::create([
                'user_id' => $merchant->user_id,
                'merchant_id' => $merchant->id,
                'method' => 'manual',
                'amount' => 10000 + $index,
                'merchant_currency_code' => 'TZS',
                'payout_currency_code' => 'TZS',
                'merchant_amount' => 10000 + $index,
                'payout_amount' => 10000 + $index,
                'status' => 'pending',
            ]);
        }

        $this->actingAs($admin)
            ->getJson('/admin/api/withdrawals?status=pending&per_page=10&page=2')
            ->assertOk()
            ->assertJsonCount(10, 'withdrawals')
            ->assertJsonPath('pagination.current_page', 2)
            ->assertJsonPath('pagination.last_page', 3)
            ->assertJsonPath('pagination.per_page', 10)
            ->assertJsonPath('pagination.total', 25);
    }

    private function merchant(): Merchant
    {
        $currency = Currency::firstOrCreate(
            ['code' => 'TZS'],
            [
                'name' => 'Tanzanian Shilling',
                'symbol' => 'TZS',
                'symbol_position' => 'prefix',
                'exchange_rate' => 2500,
                'is_base_currency' => false,
                'is_active' => true,
            ]
        );
        $country = Country::create([
            'name' => 'Tanzania',
            'iso_alpha2' => 'TZ',
            'default_currency_id' => $currency->id,
            'is_active' => true,
        ]);
        $user = User::factory()->create(['role' => 'merchant']);

        return Merchant::create([
            'user_id' => $user->id,
            'username' => 'withdrawal-merchant-' . $user->id,
            'display_name' => 'Withdrawal Merchant',
            'type' => 'business',
            'country_id' => $country->id,
            'currency_id' => $currency->id,
            'is_default' => true,
            'is_active' => true,
        ]);
    }
}
