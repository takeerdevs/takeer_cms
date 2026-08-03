<?php

namespace Tests\Feature;

use App\Models\Currency;
use App\Models\FeePolicy;
use App\Models\PaymentProviderChannel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminFeePolicyPaymentChannelTest extends TestCase
{
    use RefreshDatabase;

    public function test_fee_policy_index_exposes_payment_provider_channels_for_builder_options(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)
            ->getJson('/admin/api/fee-policies')
            ->assertOk();

        $keys = collect($response->json('payment_channels'))->pluck('key');

        $this->assertTrue($keys->contains('tz_selcom_payin_mobile_money_tzs'));
        $this->assertTrue($keys->contains('tz_selcom_payout_mobile_money_tzs'));
        $this->assertFalse($keys->contains('mobile_money_payout'));

        $channel = collect($response->json('payment_channels'))
            ->firstWhere('key', 'tz_selcom_payout_mobile_money_tzs');

        $this->assertSame('Selcom Mobile Money', $channel['name']);
        $this->assertSame('Selcom', $channel['provider_name']);
        $this->assertSame('payout', $channel['direction']);
    }

    public function test_fee_policy_page_bootstraps_provider_channels_for_payment_channel_scope(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)
            ->get('/admin/fee-policies', [
                'X-Inertia' => 'true',
                'X-Inertia-Version' => hash_file('xxh128', public_path('build/manifest.json')),
                'Accept' => 'application/json',
            ])
            ->assertOk();

        $props = $response->json('props');
        $keys = collect($props['paymentChannels'] ?? [])->pluck('key');

        $this->assertTrue($keys->contains('tz_selcom_payin_mobile_money_tzs'));
        $this->assertTrue($keys->contains('tz_selcom_payout_mobile_money_tzs'));
        $this->assertFalse($keys->contains('mobile_money_payout'));
    }

    public function test_payment_channel_policy_must_use_real_provider_channel_key(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $this->currency('USD');

        $this->actingAs($admin)
            ->postJson('/admin/api/fee-policies', $this->payload([
                'payment_channel' => 'mobile_money_payout',
            ]))
            ->assertJsonValidationErrors('payment_channel');

        $this->actingAs($admin)
            ->postJson('/admin/api/fee-policies', $this->payload([
                'payment_channel' => 'tz_selcom_payout_mobile_money_tzs',
            ]))
            ->assertCreated();

        $this->assertDatabaseHas('fee_policies', [
            'scope' => 'payment_channel',
            'payment_channel' => 'tz_selcom_payout_mobile_money_tzs',
        ]);
        $this->assertSame(1, FeePolicy::query()->where('scope', 'payment_channel')->count());
        $this->assertNotNull(PaymentProviderChannel::query()->where('key', 'tz_selcom_payout_mobile_money_tzs')->first());
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Selcom provider channel fee',
            'category' => 'sale',
            'scope' => 'payment_channel',
            'payment_channel' => 'tz_selcom_payout_mobile_money_tzs',
            'fee_type' => 'fixed',
            'percentage_rate' => 0,
            'fixed_amount' => 1,
            'fixed_fee_currency_code' => 'USD',
            'is_active' => true,
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
