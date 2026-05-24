<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\NotificationLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminMerchantAccountNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_approving_merchant_kyc_queues_owner_notifications_on_all_account_channels(): void
    {
        [$admin, $merchant] = $this->adminAndMerchant();

        $this->actingAs($admin)
            ->postJson("/admin/api/merchants/{$merchant->id}/approve-kyc")
            ->assertOk();

        $logs = NotificationLog::query()
            ->where('user_id', $merchant->user_id)
            ->where('dedupe_key', 'like', 'merchant-account-change:merchant_business_verified:%')
            ->get();

        $this->assertEqualsCanonicalizing(['email', 'sms', 'whatsapp'], $logs->pluck('channel')->all());
        $this->assertTrue($logs->every(fn (NotificationLog $log) => $log->status === 'pending'));
        $this->assertTrue($logs->every(fn (NotificationLog $log) => str_contains($log->message, 'Asha General Traders has been verified')));
        $this->assertTrue($logs->every(fn (NotificationLog $log) => str_contains($log->message, 'Some categories may still require a specific certificate')));
    }

    public function test_rejecting_merchant_kyc_queues_owner_notifications_with_reason(): void
    {
        [$admin, $merchant] = $this->adminAndMerchant([
            'is_verified' => true,
            'kyc_status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->postJson("/admin/api/merchants/{$merchant->id}/reject-kyc", [
                'reason' => 'Business license photo is unreadable.',
            ])
            ->assertOk();

        $logs = NotificationLog::query()
            ->where('user_id', $merchant->user_id)
            ->where('dedupe_key', 'like', 'merchant-account-change:merchant_business_verification_rejected:%')
            ->get();

        $this->assertEqualsCanonicalizing(['email', 'sms', 'whatsapp'], $logs->pluck('channel')->all());
        $this->assertTrue($logs->every(fn (NotificationLog $log) => str_contains($log->message, 'Business license photo is unreadable.')));
    }

    public function test_admin_disabling_merchant_account_queues_owner_notifications(): void
    {
        [$admin, $merchant] = $this->adminAndMerchant([
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->putJson("/admin/api/merchants/{$merchant->id}", [
                'is_active' => false,
            ])
            ->assertOk();

        $logs = NotificationLog::query()
            ->where('user_id', $merchant->user_id)
            ->where('dedupe_key', 'like', 'merchant-account-field:%:is_active:%')
            ->get();

        $this->assertEqualsCanonicalizing(['email', 'sms', 'whatsapp'], $logs->pluck('channel')->all());
        $this->assertTrue($logs->every(fn (NotificationLog $log) => str_contains($log->message, 'has been disabled by admin review')));
    }

    private function adminAndMerchant(array $merchantOverrides = []): array
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $owner = User::factory()->create([
            'role' => 'merchant',
            'phone_number' => '0712345678',
            'email' => 'owner@example.test',
        ]);

        $merchant = Merchant::create([
            'user_id' => $owner->id,
            'username' => 'asha-general-traders',
            'display_name' => 'Asha General Traders',
            'type' => 'business',
            'is_default' => true,
            'is_active' => true,
            'is_suspended' => false,
            'is_verified' => false,
            'kyc_status' => 'pending',
            ...$merchantOverrides,
        ]);

        return [$admin, $merchant];
    }
}
