<?php

namespace Tests\Feature;

use App\Models\MarketingEvent;
use App\Models\Merchant;
use App\Models\TrackedLink;
use App\Models\User;
use App\Services\TrackedLinkService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackedLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_tracked_link_redirect_records_click_and_marketing_event(): void
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'demo-creator',
            'display_name' => 'Demo Creator',
            'is_default' => true,
            'is_active' => true,
        ]);

        $trackedUrl = app(TrackedLinkService::class)->trackedUrlFor('https://example.com/booking?slot=morning', [
            'merchant_id' => $merchant->id,
            'link_type' => 'storefront_link',
            'source_surface' => 'storefront',
            'entity_type' => 'merchant',
            'entity_id' => $merchant->id,
            'label' => 'Book now',
        ]);

        $link = TrackedLink::query()->firstOrFail();
        $this->assertSame($trackedUrl, route('tracked-links.follow', $link->code));

        $this->withCookie('takeer_attribution_session', 'atk_existing_session')
            ->get(parse_url($trackedUrl, PHP_URL_PATH))
            ->assertRedirect('https://example.com/booking?slot=morning');

        $this->assertSame(1, $link->fresh()->clicks_count);
        $this->assertNotNull($link->fresh()->last_clicked_at);

        $this->assertDatabaseHas('marketing_events', [
            'merchant_id' => $merchant->id,
            'session_id' => 'atk_existing_session',
            'event_type' => 'outbound_click',
            'entity_type' => 'merchant',
            'entity_id' => $merchant->id,
            'source' => 'storefront_link',
            'landing_url' => 'https://example.com/booking?slot=morning',
        ]);

        $this->assertSame('example.com', MarketingEvent::query()->firstOrFail()->metadata['destination_host']);
    }

    public function test_internal_urls_are_not_wrapped(): void
    {
        $trackedUrl = app(TrackedLinkService::class)->trackedUrlFor(config('app.url').'/m/demo-creator', [
            'link_type' => 'storefront_link',
        ]);

        $this->assertNull($trackedUrl);
        $this->assertSame(0, TrackedLink::query()->count());
    }

    public function test_tracked_link_can_be_reported_and_disabled_by_admin(): void
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $admin = User::factory()->create(['is_admin' => true]);
        $merchant = Merchant::query()->create([
            'user_id' => $user->id,
            'username' => 'demo-creator',
            'display_name' => 'Demo Creator',
            'is_default' => true,
            'is_active' => true,
        ]);

        $trackedUrl = app(TrackedLinkService::class)->trackedUrlFor('https://bad.example/phish', [
            'merchant_id' => $merchant->id,
            'link_type' => 'storefront_link',
            'source_surface' => 'storefront',
            'entity_type' => 'merchant',
            'entity_id' => $merchant->id,
        ]);
        $link = TrackedLink::query()->firstOrFail();

        $this->postJson('/go/'.$link->code.'/report', [
            'reason' => 'misleading',
            'reason_code' => 'phishing',
            'notes' => 'This looks suspicious.',
        ])->assertCreated();

        $this->assertDatabaseHas('content_reports', [
            'merchant_id' => $merchant->id,
            'item_type' => 'tracked_link',
            'item_id' => $link->id,
            'reason_code' => 'phishing',
            'status' => 'open',
        ]);

        $this->actingAs($admin)
            ->getJson('/admin/api/tracked-links?reported=1')
            ->assertOk()
            ->assertJsonPath('data.0.id', $link->id)
            ->assertJsonPath('data.0.open_reports_count', 1);

        $this->actingAs($admin)
            ->patchJson('/admin/api/tracked-links/'.$link->id, [
                'status' => 'disabled',
                'moderation_note' => 'Phishing report confirmed.',
            ])
            ->assertOk()
            ->assertJsonPath('tracked_link.status', 'disabled');

        $this->get(parse_url($trackedUrl, PHP_URL_PATH))->assertGone();

        $this->assertDatabaseHas('pulse_notifications', [
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'event_type' => 'tracked_link_disabled',
            'status' => 'disabled',
        ]);
    }
}
