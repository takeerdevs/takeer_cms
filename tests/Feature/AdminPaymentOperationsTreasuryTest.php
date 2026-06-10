<?php

namespace Tests\Feature;

use App\Models\PaymentProviderChannel;
use App\Models\ProviderTreasuryAccount;
use App\Models\User;
use App\Services\PaymentProviderCatalogService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminPaymentOperationsTreasuryTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_provider_liquidity_per_payout_channel_currency(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        app(PaymentProviderCatalogService::class)->ensureDefaults();
        $channel = PaymentProviderChannel::query()
            ->where('key', 'tz_selcom_payout_mobile_money_tzs')
            ->firstOrFail();

        $this->actingAs($admin)
            ->putJson("/admin/api/payment-operations/channels/{$channel->id}", [
                'status' => 'enabled',
                'priority' => 10,
                'fee_type' => 'fixed_plus_percent',
                'fee_fixed' => 0,
                'fee_percent_bps' => 0,
                'fee_min' => 0,
                'fee_max' => null,
                'fx_margin_bps' => 0,
                'limits' => [
                    'min_withdrawal_amount' => 5000,
                    'max_withdrawal_amount' => 3000000,
                ],
                'treasury_accounts' => [
                    [
                        'currency_code' => 'TZS',
                        'balance_amount' => 1000000,
                        'minimum_available_amount' => 50000,
                        'status' => 'active',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('channel.treasury_accounts.0.currency_code', 'TZS');

        $account = ProviderTreasuryAccount::query()->firstOrFail();

        $this->assertSame($channel->id, $account->payment_provider_channel_id);
        $this->assertSame('selcom', $account->provider_key);
        $this->assertSame('TZS', $account->currency_code);
        $this->assertSame(1000000.0, (float) $account->balance_amount);
        $this->assertSame(50000.0, (float) $account->minimum_available_amount);
        $this->assertSame(950000.0, $account->availableAmount());
    }
}
