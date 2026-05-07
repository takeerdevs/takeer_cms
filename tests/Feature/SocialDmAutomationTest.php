<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\MerchantSocialAccount;
use App\Models\MerchantSocialDmCampaign;
use App\Models\MerchantSocialDmEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class SocialDmAutomationTest extends TestCase
{
    use RefreshDatabase;

    public function test_meta_webhook_verification_challenge_succeeds(): void
    {
        Config::set('services.meta.webhook_verify_token', 'verify-secret');

        $response = $this->get('/api/webhooks/social/comments?hub_mode=subscribe&hub_verify_token=verify-secret&hub_challenge=challenge-123');

        $response->assertOk();
        $this->assertSame('challenge-123', $response->getContent());
    }

    public function test_meta_webhook_rejects_invalid_signature(): void
    {
        Config::set('services.meta.client_secret', 'app-secret');

        $this->postJson('/api/webhooks/social/comments', ['entry' => []], [
            'X-Hub-Signature-256' => 'sha256=bad-signature',
        ])->assertForbidden();
    }

    public function test_signed_meta_comment_webhook_matches_campaign_and_simulates_dm(): void
    {
        Config::set('services.meta.client_secret', 'app-secret');
        [$merchant, $account, $campaign] = $this->socialDmFixture();

        $payload = [
            'entry' => [[
                'id' => $account->provider_account_id,
                'changes' => [[
                    'field' => 'comments',
                    'value' => [
                        'id' => 'comment_1',
                        'media_id' => 'media_1',
                        'text' => 'Please send the LINK',
                        'from' => [
                            'id' => 'ig_user_1',
                            'username' => 'buyer_one',
                        ],
                    ],
                ]],
            ]],
        ];

        $response = $this->signedMetaPost($payload);

        $response->assertOk()
            ->assertJsonPath('received', true)
            ->assertJsonPath('events.0.status', 'dm_simulated');

        $this->assertDatabaseHas('merchant_social_dm_events', [
            'merchant_id' => $merchant->id,
            'campaign_id' => $campaign->id,
            'provider_comment_id' => 'comment_1',
            'provider_post_id' => 'media_1',
            'matched_keyword' => 'link',
            'status' => 'dm_simulated',
        ]);

        $this->assertSame(1, $campaign->fresh()->dm_sent_count);
        $this->assertSame(1, $campaign->fresh()->matched_count);
    }

    public function test_duplicate_comment_webhook_is_not_sent_twice(): void
    {
        Config::set('services.meta.client_secret', 'app-secret');
        [, , $campaign] = $this->socialDmFixture();

        $payload = [
            'platform' => 'instagram',
            'account_id' => '17890000000000000',
            'post_id' => 'media_1',
            'comment_id' => 'comment_duplicate',
            'commenter_username' => 'buyer_one',
            'text' => 'link please',
        ];

        $this->signedMetaPost($payload)->assertOk();
        $this->signedMetaPost($payload)->assertOk();

        $this->assertSame(1, MerchantSocialDmEvent::query()->where('provider_comment_id', 'comment_duplicate')->count());
        $this->assertSame(1, $campaign->fresh()->dm_sent_count);
    }

    public function test_dm_tracking_link_redirects_and_records_click(): void
    {
        [, , $campaign] = $this->socialDmFixture();

        $event = MerchantSocialDmEvent::query()->create([
            'merchant_id' => $campaign->merchant_id,
            'campaign_id' => $campaign->id,
            'social_account_id' => $campaign->social_account_id,
            'platform' => 'instagram',
            'provider_comment_id' => 'comment_track',
            'provider_post_id' => 'media_1',
            'status' => 'dm_simulated',
            'destination_url' => url('/m/demo-creator'),
            'received_at' => now(),
            'sent_at' => now(),
        ]);

        $this->get('/dm/t/'.$event->id.'?to='.rawurlencode(url('/m/demo-creator')))
            ->assertRedirect(url('/m/demo-creator').'?source=social_dm&utm_source=instagram&utm_medium=dm&utm_campaign=social_dm_'.$campaign->id);

        $this->assertNotNull($event->fresh()->clicked_at);
        $this->assertSame(1, $campaign->fresh()->clicks_count);
        $this->assertDatabaseHas('marketing_events', [
            'merchant_id' => $campaign->merchant_id,
            'event_type' => 'social_dm_click',
            'entity_type' => 'merchant_social_dm_campaign',
            'entity_id' => $campaign->id,
        ]);
    }

    private function signedMetaPost(array $payload)
    {
        $json = json_encode($payload);
        $signature = 'sha256='.hash_hmac('sha256', $json, 'app-secret');

        return $this->call('POST', '/api/webhooks/social/comments', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_HUB_SIGNATURE_256' => $signature,
        ], $json);
    }

    private function socialDmFixture(): array
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'demo-creator',
            'display_name' => 'Demo Creator',
            'is_default' => true,
            'is_active' => true,
        ]);
        $account = MerchantSocialAccount::query()->create([
            'merchant_id' => $merchant->id,
            'connected_by' => $user->id,
            'platform' => 'instagram',
            'provider_account_id' => '17890000000000000',
            'username' => 'demo_creator',
            'account_type' => 'creator',
            'status' => 'connected',
        ]);
        $campaign = MerchantSocialDmCampaign::query()->create([
            'merchant_id' => $merchant->id,
            'social_account_id' => $account->id,
            'created_by' => $user->id,
            'name' => 'Link trigger',
            'platform' => 'instagram',
            'post_provider_id' => 'media_1',
            'trigger_keywords' => ['link'],
            'match_mode' => 'contains',
            'destination_type' => 'storefront',
            'destination_url' => '/m/demo-creator',
            'dm_message' => 'Here is your link: {{link}}',
            'status' => 'active',
        ]);

        return [$merchant, $account, $campaign];
    }
}
