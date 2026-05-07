<?php

namespace Tests\Feature;

use App\Models\MarketingEvent;
use App\Models\Merchant;
use App\Models\MerchantWhatsappAccount;
use App\Models\MerchantWhatsappAutomation;
use App\Models\MerchantWhatsappEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class WhatsappCommerceTest extends TestCase
{
    use RefreshDatabase;

    public function test_whatsapp_webhook_verification_challenge_succeeds(): void
    {
        Config::set('services.whatsapp_cloud.webhook_verify_token', 'wa-verify');

        $response = $this->get('/api/webhooks/whatsapp?hub_mode=subscribe&hub_verify_token=wa-verify&hub_challenge=wa-challenge');

        $response->assertOk();
        $this->assertSame('wa-challenge', $response->getContent());
    }

    public function test_whatsapp_webhook_rejects_invalid_signature(): void
    {
        Config::set('services.whatsapp_cloud.app_secret', 'wa-secret');

        $this->postJson('/api/webhooks/whatsapp', ['entry' => []], [
            'X-Hub-Signature-256' => 'sha256=bad',
        ])->assertForbidden();
    }

    public function test_signed_whatsapp_message_matches_automation_and_simulates_reply(): void
    {
        Config::set('services.whatsapp_cloud.app_secret', 'wa-secret');
        [$merchant, $account, $automation] = $this->whatsappFixture();

        $payload = [
            'entry' => [[
                'changes' => [[
                    'value' => [
                        'metadata' => [
                            'phone_number_id' => $account->phone_number_id,
                            'display_phone_number' => '+255 700 000 001',
                        ],
                        'contacts' => [[
                            'wa_id' => '255700000222',
                            'profile' => ['name' => 'Buyer One'],
                        ]],
                        'messages' => [[
                            'id' => 'wamid.1',
                            'from' => '255700000222',
                            'type' => 'text',
                            'text' => ['body' => 'please send catalog'],
                        ]],
                    ],
                ]],
            ]],
        ];

        $this->signedWhatsappPost($payload)
            ->assertOk()
            ->assertJsonPath('received', true)
            ->assertJsonPath('events.0.status', 'simulated');

        $this->assertDatabaseHas('merchant_whatsapp_events', [
            'merchant_id' => $merchant->id,
            'automation_id' => $automation->id,
            'provider_message_id' => 'wamid.1',
            'from_phone' => '255700000222',
            'matched_keyword' => 'catalog',
            'status' => 'simulated',
        ]);
        $this->assertSame(1, $automation->fresh()->sent_count);
    }

    public function test_duplicate_whatsapp_message_is_not_sent_twice(): void
    {
        Config::set('services.whatsapp_cloud.app_secret', 'wa-secret');
        [, $account, $automation] = $this->whatsappFixture();

        $payload = [
            'phone_number_id' => $account->phone_number_id,
            'message_id' => 'wamid.duplicate',
            'from_phone' => '255700000222',
            'profile_name' => 'Buyer One',
            'text' => 'catalog',
        ];

        $this->signedWhatsappPost($payload)->assertOk();
        $this->signedWhatsappPost($payload)->assertOk();

        $this->assertSame(1, MerchantWhatsappEvent::query()->where('provider_message_id', 'wamid.duplicate')->count());
        $this->assertSame(1, $automation->fresh()->sent_count);
    }

    public function test_whatsapp_tracking_link_redirects_and_records_click(): void
    {
        [, , $automation] = $this->whatsappFixture();
        $event = MerchantWhatsappEvent::query()->create([
            'merchant_id' => $automation->merchant_id,
            'automation_id' => $automation->id,
            'whatsapp_account_id' => $automation->whatsapp_account_id,
            'provider_message_id' => 'wamid.track',
            'from_phone' => '255700000222',
            'status' => 'simulated',
            'destination_url' => url('/m/wa-demo'),
            'received_at' => now(),
            'sent_at' => now(),
        ]);

        $this->get('/wa/t/'.$event->id.'?to='.rawurlencode(url('/m/wa-demo')))
            ->assertRedirect(url('/m/wa-demo').'?source=whatsapp&utm_source=whatsapp&utm_medium=chat&utm_campaign=whatsapp_'.$automation->id);

        $this->assertNotNull($event->fresh()->clicked_at);
        $this->assertSame(1, $automation->fresh()->clicks_count);
        $this->assertSame(1, MarketingEvent::query()->where('event_type', 'whatsapp_click')->count());
    }

    private function signedWhatsappPost(array $payload)
    {
        $json = json_encode($payload);

        return $this->call('POST', '/api/webhooks/whatsapp', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_HUB_SIGNATURE_256' => 'sha256='.hash_hmac('sha256', $json, 'wa-secret'),
        ], $json);
    }

    private function whatsappFixture(): array
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'wa-demo',
            'display_name' => 'WA Demo',
            'is_default' => true,
            'is_active' => true,
        ]);
        $account = MerchantWhatsappAccount::query()->create([
            'merchant_id' => $merchant->id,
            'connected_by' => $user->id,
            'phone_number_id' => '1234567890',
            'display_phone_number' => '+255700000001',
            'verified_name' => 'WA Demo',
            'status' => 'connected',
        ]);
        $automation = MerchantWhatsappAutomation::query()->create([
            'merchant_id' => $merchant->id,
            'whatsapp_account_id' => $account->id,
            'created_by' => $user->id,
            'name' => 'Catalog responder',
            'trigger_keywords' => ['catalog'],
            'match_mode' => 'contains',
            'destination_type' => 'storefront',
            'destination_url' => '/m/wa-demo',
            'response_message' => 'Shop here: {{link}}',
            'status' => 'active',
        ]);

        return [$merchant, $account, $automation];
    }
}
