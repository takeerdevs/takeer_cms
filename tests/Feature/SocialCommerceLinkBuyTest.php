<?php

namespace Tests\Feature;

use App\Jobs\SendSocialCommerceOfferToBuyer;
use App\Models\Merchant;
use App\Models\Order;
use App\Models\Product;
use App\Models\LinkPreview;
use App\Models\SocialCommerceRequest;
use App\Models\SocialCommerceRequestInvitation;
use App\Models\User;
use App\Models\UserAddress;
use App\Services\LinkPreviewService;
use App\Services\SocialCommerceNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SocialCommerceLinkBuyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('s3');
        Http::fake([
            'https://instagram.com/media.jpg' => Http::response('fake-image', 200, ['Content-Type' => 'image/jpeg']),
            'https://instagram.com/*' => Http::response('<html><head><meta property="og:title" content="Social shoes"><meta property="og:description" content="A public listing"><meta property="og:image" content="https://instagram.com/media.jpg"></head></html>', 200, ['Content-Type' => 'text/html']),
        ]);
    }

    public function test_buy_from_social_media_entry_is_public_and_not_a_not_found_response(): void
    {
        $this->get('/buy-from-social-media')->assertOk();
    }

    public function test_public_product_can_be_found_by_its_assigned_tk_code(): void
    {
        $seller = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::query()->create([
            'user_id' => $seller->id,
            'username' => 'live-code-seller',
            'display_name' => 'Live Code Seller',
            'is_default' => true,
            'is_active' => true,
            'is_verified' => true,
        ]);
        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'TikTok live handbag',
            'slug' => 'tiktok-live-handbag',
            'type' => 'physical',
            'price' => 45000,
            'inventory_count' => 3,
        ])->refresh();

        $this->assertMatchesRegularExpression('/^TK[0-9]{5,}$/', $product->product_code);

        $this->getJson('/api/products/code/'.$product->product_code)
            ->assertOk()
            ->assertJsonPath('found', true)
            ->assertJsonPath('product.code', $product->product_code)
            ->assertJsonPath('product.title', 'TikTok live handbag')
            ->assertJsonPath('product.url', route('product.show', ['product' => $product->slug]))
            ->assertJsonPath('product.merchant.username', 'live-code-seller');
        $this->assertStringContainsString('utm_source=takeer_code', (string) $this->getJson('/api/products/code/'.$product->product_code)->json('product.tracking_url'));

        $this->getJson('/api/products/code/'.strtolower($product->product_code))
            ->assertOk()
            ->assertJsonPath('product.code', $product->product_code);
    }

    public function test_preview_accepts_an_ordinary_public_product_website(): void
    {
        Http::fake([
            'https://example.com/items/sofa' => Http::response(
                '<html><head><meta property="og:title" content="Blue sofa"><meta property="og:description" content="Call seller to order"></head></html>',
                200,
                ['Content-Type' => 'text/html'],
            ),
        ]);

        $this->postJson('/api/social-commerce/previews', [
            'url' => 'https://example.com/items/sofa?utm_source=tiktok',
        ])->assertOk()
            ->assertJsonPath('link.platform', 'web')
            ->assertJsonPath('link.normalized_url', 'https://example.com/items/sofa');

        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000071',
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://example.com/items/sofa?utm_source=tiktok',
            'idempotency_key' => 'generic-web-source-1',
            'buyer_product_note' => 'Blue sofa',
            'requested_quantity' => 1,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => true,
        ])->assertCreated()
            ->assertJsonPath('request.source.key', 'web')
            ->assertJsonPath('request.source.label', 'example.com');

        $this->actingAs($buyer)->getJson('/api/social-commerce/requests')
            ->assertOk()
            ->assertJsonPath('data.0.source.label', 'example.com');
    }

    public function test_guest_cannot_create_a_social_commerce_request(): void
    {
        $this->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/GUEST123/',
            'idempotency_key' => 'guest-request-1',
            'buyer_product_note' => 'Guest product',
            'requested_quantity' => 1,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => true,
        ])->assertUnauthorized();

        $this->assertDatabaseCount('social_commerce_requests', 0);
    }

    public function test_invited_seller_can_dismiss_an_unrelated_listing_and_retained_evidence_is_removed(): void
    {
        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000099',
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($buyer)->post('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/NOT_THE_SELLER/',
            'idempotency_key' => 'seller-dismiss-1',
            'buyer_product_note' => 'Wrong seller item',
            'requested_quantity' => 1,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => '1',
            'buyer_screenshot' => UploadedFile::fake()->image('wrong-item.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $socialRequest = SocialCommerceRequest::query()->firstOrFail();
        $evidencePath = substr((string) $socialRequest->buyer_screenshot_path, strlen('private://'));
        Storage::disk('s3')->assertExists($evidencePath);

        $inviteResponse = $this->actingAs($buyer)->postJson('/api/social-commerce/requests/'.$socialRequest->public_id.'/invitations', [
            'channel' => 'copy',
        ])->assertCreated();
        $fragment = (string) parse_url((string) $inviteResponse->json('claim_url'), PHP_URL_FRAGMENT);
        $token = str_starts_with($fragment, 'token=') ? substr($fragment, 6) : '';
        $invitation = SocialCommerceRequestInvitation::query()->firstOrFail();

        auth()->guard('web')->logout();
        $this->postJson('/api/social-commerce/claims/'.$invitation->public_id.'/dismiss', [
            'claim_token' => $token,
        ])->assertOk()->assertJsonPath('request_status', SocialCommerceRequest::DECLINED);

        $socialRequest->refresh();
        $this->assertSame('seller_not_listing', $socialRequest->closed_reason);
        $this->assertSame('redacted://seller-dismissed', $socialRequest->original_url);
        $this->assertNull($socialRequest->buyer_screenshot_path);
        $this->assertNull($socialRequest->preview_snapshot);
        $this->assertSame('revoked', $invitation->fresh()->status);
        Storage::disk('s3')->assertMissing($evidencePath);
    }

    public function test_buyer_can_attach_private_screenshot_evidence_for_a_carousel_item(): void
    {
        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000006',
            'phone_verified_at' => now(),
        ]);
        $screenshot = UploadedFile::fake()->image('selected-carousel-item.jpg', 1200, 1600);

        $response = $this->actingAs($buyer)->post('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/CAROUSEL123/',
            'idempotency_key' => 'carousel-evidence-1',
            'buyer_product_note' => 'The brown handbag in the third image',
            'requested_quantity' => 1,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => '1',
            'buyer_screenshot' => $screenshot,
        ], ['Accept' => 'application/json'])->assertCreated();

        $request = SocialCommerceRequest::query()->firstOrFail();
        $storedPath = (string) $request->buyer_screenshot_path;
        $this->assertStringStartsWith('private://social-commerce/evidence/', $storedPath);
        Storage::disk('s3')->assertExists(substr($storedPath, strlen('private://')));
        $response->assertJsonPath('request.buyer_evidence.available', true);
        $this->assertStringContainsString('/api/social-commerce/requests/'.$request->public_id.'/buyer-screenshot', (string) $response->json('request.buyer_evidence.screenshot_url'));

        $otherBuyer = User::factory()->create(['role' => 'buyer', 'phone_verified_at' => now()]);
        $this->actingAs($otherBuyer)->getJson('/api/social-commerce/requests/'.$request->public_id.'/buyer-screenshot')->assertForbidden();
        $this->actingAs($buyer)->get('/api/social-commerce/requests/'.$request->public_id.'/buyer-screenshot')->assertRedirect();
    }

    public function test_social_commerce_request_requires_seller_phone_and_buyer_attestation(): void
    {
        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000005',
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/PHONE_REQUIRED/',
            'idempotency_key' => 'phone-required-1',
            'buyer_product_note' => 'Product without phone',
            'requested_quantity' => 1,
        ])->assertStatus(422)->assertJsonValidationErrors(['seller_phone', 'seller_phone_source', 'seller_contact_attested']);

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/PHONE_ATTESTATION/',
            'idempotency_key' => 'phone-attestation-1',
            'buyer_product_note' => 'Product without attestation',
            'requested_quantity' => 1,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => false,
        ])->assertStatus(422)->assertJsonValidationErrors('seller_contact_attested');
    }

    public function test_buyer_can_create_secure_request_invite_claim_offer_and_one_quoted_order(): void
    {
        Queue::fake();
        $buyer = User::factory()->create(['role' => 'buyer', 'phone_number' => '+255700000001', 'phone_verified_at' => now()]);
        $sellerUser = User::factory()->create(['role' => 'merchant', 'phone_number' => '+255700000002', 'phone_verified_at' => now()]);
        $merchant = Merchant::query()->create([
            'user_id' => $sellerUser->id,
            'username' => 'social-seller',
            'display_name' => 'Social Seller',
            'is_default' => true,
            'is_active' => true,
            'is_verified' => true,
            'kyc_status' => 'verified',
        ]);

        $requestResponse = $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/SHOES123/?utm_source=share',
            'idempotency_key' => 'buyer-request-1',
            'buyer_product_note' => 'Black running shoes',
            'requested_quantity' => 1,
            'destination_summary' => 'Kinondoni, Dar es Salaam',
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => true,
        ])->assertCreated();
        $request = SocialCommerceRequest::query()->firstOrFail();
        $requestResponse->assertJsonPath('request.status', SocialCommerceRequest::AWAITING_SELLER);
        $requestResponse->assertJsonPath('request.source.label', 'Instagram');
        $this->assertDatabaseCount('orders', 0);

        $otherBuyer = User::factory()->create(['role' => 'buyer', 'phone_verified_at' => now()]);
        $this->actingAs($otherBuyer)
            ->get('/social-commerce/requests/'.$request->public_id)
            ->assertForbidden();

        $inviteResponse = $this->actingAs($buyer)->postJson('/api/social-commerce/requests/'.$request->public_id.'/invitations', [
            'channel' => 'copy',
        ])->assertCreated();
        $claimUrl = $inviteResponse->json('claim_url');
        $shortClaimUrl = $inviteResponse->json('short_claim_url');
        $token = parse_url($claimUrl, PHP_URL_FRAGMENT);
        $token = str_starts_with((string) $token, 'token=') ? substr((string) $token, 6) : '';
        $invitation = SocialCommerceRequestInvitation::query()->firstOrFail();
        $this->assertNotSame('', $token);
        $this->assertMatchesRegularExpression('#/sb/[A-Za-z0-9]{16}$#', (string) $shortClaimUrl);
        $this->assertSame(16, strlen((string) $invitation->short_code));
        $this->assertNotSame('', (string) $invitation->short_token_hash);
        $this->assertStringNotContainsString($token, json_encode($invitation->message_snapshot));
        $this->get($shortClaimUrl)->assertRedirect(route('social-commerce.claim', ['invitation' => $invitation->public_id]).'#token='.$invitation->short_code);

        $reusedInviteResponse = $this->actingAs($buyer)->postJson('/api/social-commerce/requests/'.$request->public_id.'/invitations', [
            'channel' => 'copy',
        ])->assertCreated();
        $this->assertSame($shortClaimUrl, $reusedInviteResponse->json('short_claim_url'));
        $this->assertDatabaseCount('social_commerce_request_invitations', 1);

        $this->actingAs($sellerUser)->postJson('/api/social-commerce/claims/'.$invitation->public_id.'/accept', [
            'claim_token' => $token,
            'merchant_id' => $merchant->id,
        ])->assertOk();
        $this->actingAs($sellerUser)->getJson('/api/merchant/social-commerce/requests')
            ->assertOk()
            ->assertJsonPath('data.0.source.label', 'Instagram')
            ->assertJsonPath('source_summary.0.label', 'Instagram')
            ->assertJsonPath('source_summary.0.count', 1);
        $this->assertSame(SocialCommerceRequest::PRODUCT_SETUP, $request->fresh()->status);

        $product = Product::query()->create([
            'merchant_id' => $merchant->id,
            'title' => 'Seller shoes',
            'slug' => 'seller-shoes-social',
            'type' => 'physical',
            'price' => 50000,
            'inventory_count' => 5,
        ]);

        $this->actingAs($sellerUser)->getJson('/api/merchant/social-commerce/requests/'.$request->public_id.'/products?q=Seller')
            ->assertOk()
            ->assertJsonPath('data.0.id', $product->id);

        $this->actingAs($sellerUser)->postJson('/api/merchant/social-commerce/requests/'.$request->public_id.'/match-product', [
            'product_id' => $product->id,
        ])->assertOk()
            ->assertJsonPath('data.product.id', $product->id)
            ->assertJsonPath('data.product.slug', $product->slug)
            ->assertJsonPath('data.product.url', route('product.show', ['product' => $product->slug]));
        $this->assertDatabaseHas('social_product_links', [
            'platform' => 'instagram',
            'url_hash' => $request->url_hash,
            'product_id' => $product->id,
            'merchant_id' => $merchant->id,
        ]);
        $this->postJson('/api/social-commerce/resolve', ['url' => $request->original_url])
            ->assertOk()
            ->assertJsonPath('matched', true)
            ->assertJsonPath('product.id', $product->id)
            ->assertJsonPath('product.url', route('product.show', ['product' => $product->slug]))
            ->assertJsonPath('source.key', 'instagram');
        $this->assertStringContainsString('utm_source=instagram', (string) $this->postJson('/api/social-commerce/resolve', ['url' => $request->original_url])->json('tracking_url'));
        $this->actingAs($sellerUser)->postJson('/api/merchant/social-commerce/requests/'.$request->public_id.'/offer', [
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 50000,
            'shipping_fee' => 5000,
            'currency_code' => 'TZS',
            'delivery_type' => 'local_boda',
        ])->assertOk()->assertJsonPath('data.status', SocialCommerceRequest::OFFER_READY);
        $this->actingAs($sellerUser)->postJson('/api/merchant/social-commerce/requests/'.$request->public_id.'/send-offer')->assertOk();
        Queue::assertPushed(SendSocialCommerceOfferToBuyer::class);

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests/'.$request->public_id.'/offers/accept', [
            'idempotency_key' => 'accept-1',
            'accept_terms' => true,
            'physical_address' => 'Mbezi Beach, near the main road',
        ])->assertCreated();

        $order = Order::query()->firstOrFail();
        $this->assertSame('pending', $order->payment_status);
        $this->assertTrue((bool) $order->is_inquiry);
        $this->assertSame('quoted', $order->inquiry_status);
        $this->assertSame($request->id, $order->social_commerce_request_id);
        $this->assertSame(SocialCommerceRequest::CONVERTED, $request->fresh()->status);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_buyer_saved_delivery_address_is_scoped_and_kept_in_encrypted_request_context(): void
    {
        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000011',
            'phone_verified_at' => now(),
        ]);
        $otherUser = User::factory()->create(['role' => 'buyer']);
        $address = UserAddress::query()->create([
            'user_id' => $buyer->id,
            'name' => 'Home',
            'type' => 'local',
            'address_line' => 'Mbezi Beach, Dar es Salaam',
            'extra_details' => 'Near the main road',
            'latitude' => -6.70000000,
            'longitude' => 39.20000000,
            'is_default' => true,
        ]);
        $otherAddress = UserAddress::query()->create([
            'user_id' => $otherUser->id,
            'name' => 'Other home',
            'type' => 'local',
            'address_line' => 'Another private address',
        ]);

        $response = $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/ADDRESS123/?igsh=tracking',
            'idempotency_key' => 'buyer-address-request-1',
            'buyer_product_note' => 'Social shoes',
            'requested_quantity' => 1,
            'user_address_id' => $address->id,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => true,
        ])->assertCreated();

        $request = SocialCommerceRequest::query()->firstOrFail();
        $this->assertSame('saved_address', $request->deliveryContext()['source']);
        $this->assertSame($address->id, $request->deliveryContext()['address_id']);
        $this->assertSame('Mbezi Beach, Dar es Salaam', $request->deliveryContext()['address_line']);
        $this->assertStringNotContainsString('Mbezi Beach', (string) $request->getRawOriginal('delivery_context_encrypted'));
        $response->assertJsonPath('request.destination.address', 'Mbezi Beach, Dar es Salaam');
        $response->assertJsonPath('request.destination.extra_details', 'Near the main road');

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/ADDRESS456/',
            'idempotency_key' => 'buyer-address-request-2',
            'buyer_product_note' => 'Another item',
            'requested_quantity' => 1,
            'user_address_id' => $otherAddress->id,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'buyer_entered',
            'seller_contact_attested' => true,
        ])->assertStatus(422);
    }

    public function test_social_preview_returns_public_image_when_metadata_contains_one(): void
    {
        $preview = LinkPreview::query()->create([
            'url_hash' => hash('sha256', 'https://instagram.com/p/IMAGE123/'),
            'url' => 'https://instagram.com/p/IMAGE123/',
            'final_url' => 'https://instagram.com/p/IMAGE123/',
            'title' => 'Social shoes',
            'description' => 'A public listing',
            'site_name' => 'Instagram',
            'remote_image_url' => 'https://instagram.com/media.jpg',
            'image_url' => 'https://instagram.com/media.jpg',
            'status' => 'success',
            'fetched_at' => now(),
            'expires_at' => now()->addDay(),
        ]);
        $this->mock(LinkPreviewService::class, function ($mock) use ($preview): void {
            $mock->shouldReceive('previewForUrl')
                ->once()
                ->withArgs(fn (string $url, bool $refreshMissingImage): bool => $url === 'https://instagram.com/p/IMAGE123/' && $refreshMissingImage)
                ->andReturn($preview);
        });

        $response = $this->postJson('/api/social-commerce/previews', [
            'url' => 'https://www.instagram.com/p/IMAGE123/?utm_source=share&igsh=tracking',
        ])->assertOk();

        $response->assertJsonPath('preview.title', 'Social shoes');
        $this->assertNotEmpty($response->json('preview.image_url'));
    }

    public function test_social_preview_extracts_seller_handle_from_public_metadata(): void
    {
        $preview = LinkPreview::query()->create([
            'url_hash' => hash('sha256', 'https://instagram.com/p/HANDLE123/'),
            'url' => 'https://instagram.com/p/HANDLE123/',
            'final_url' => 'https://instagram.com/p/HANDLE123/',
            'title' => 'Top Africa company limited on Instagram',
            'description' => '1 likes, 0 comments - majengo_general_traders on August 3, 2026: "Gasoline lawn mower"',
            'site_name' => 'Instagram',
            'image_url' => 'https://instagram.com/media.jpg',
            'status' => 'success',
            'fetched_at' => now(),
            'expires_at' => now()->addDay(),
        ]);
        $this->mock(LinkPreviewService::class, function ($mock) use ($preview): void {
            $mock->shouldReceive('previewForUrl')
                ->once()
                ->withArgs(fn (string $url, bool $refreshMissingImage): bool => $url === 'https://instagram.com/p/HANDLE123/' && $refreshMissingImage)
                ->andReturn($preview);
        });

        $response = $this->postJson('/api/social-commerce/previews', [
            'url' => 'https://www.instagram.com/p/HANDLE123/',
        ])->assertOk();

        $response->assertJsonPath('seller_identity.handle', 'majengo_general_traders');
        $response->assertJsonPath('seller_identity.profile_url', 'https://www.instagram.com/majengo_general_traders/');
        $response->assertJsonPath('link.external_seller_handle', 'majengo_general_traders');
    }

    public function test_facebook_share_preview_resolves_to_marketplace_item_and_extracts_profile_signal(): void
    {
        $preview = LinkPreview::query()->create([
            'url_hash' => hash('sha256', 'https://facebook.com/share/1FgxsXfWgz/'),
            'url' => 'https://facebook.com/share/1FgxsXfWgz/',
            'final_url' => 'https://web.facebook.com/marketplace/item/987654321/',
            'title' => 'Vintage sofa | Facebook Marketplace',
            'description' => 'Seller profile: https://www.facebook.com/majengo.traders/',
            'site_name' => 'Facebook',
            'image_url' => 'https://facebook.com/media.jpg',
            'status' => 'success',
            'fetched_at' => now(),
            'expires_at' => now()->addDay(),
        ]);
        $this->mock(LinkPreviewService::class, function ($mock) use ($preview): void {
            $mock->shouldReceive('previewForUrl')
                ->once()
                ->withArgs(fn (string $url, bool $refreshMissingImage): bool => $url === 'https://facebook.com/share/1FgxsXfWgz/' && $refreshMissingImage)
                ->andReturn($preview);
        });

        $response = $this->postJson('/api/social-commerce/previews', [
            'url' => 'https://web.facebook.com/share/1FgxsXfWgz/?ref=share',
        ])->assertOk();

        $response->assertJsonPath('link.normalized_url', 'https://facebook.com/marketplace/item/987654321/');
        $response->assertJsonPath('link.external_post_id', '987654321');
        $response->assertJsonPath('seller_identity.handle', 'majengo.traders');
        $response->assertJsonPath('seller_identity.profile_url', 'https://www.facebook.com/majengo.traders/');
    }

    public function test_matching_handle_and_attested_phone_recognizes_a_previous_takeer_merchant(): void
    {
        $merchantUser = User::factory()->create([
            'role' => 'merchant',
            'phone_number' => '+255700000041',
            'phone_verified_at' => now(),
        ]);
        $merchant = Merchant::query()->create([
            'user_id' => $merchantUser->id,
            'username' => 'majengo-traders',
            'display_name' => 'Majengo Traders',
            'is_default' => true,
            'is_active' => true,
            'is_verified' => true,
            'kyc_status' => 'verified',
        ]);
        $firstBuyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000042',
            'phone_verified_at' => now(),
        ]);
        $secondBuyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000043',
            'phone_verified_at' => now(),
        ]);

        $linkPreviews = [];
        foreach (['MATCH123', 'MATCH456'] as $postId) {
            $linkPreviews[] = LinkPreview::query()->create([
                'url_hash' => hash('sha256', 'https://instagram.com/p/' . $postId . '/'),
                'url' => 'https://instagram.com/p/' . $postId . '/',
                'final_url' => 'https://instagram.com/p/' . $postId . '/',
                'title' => 'Majengo Traders on Instagram',
                'description' => '1 likes, 0 comments - majengo_general_traders on August 3, 2026: "Product"',
                'site_name' => 'Instagram',
                'image_url' => 'https://instagram.com/media.jpg',
                'status' => 'success',
                'fetched_at' => now(),
                'expires_at' => now()->addDay(),
            ]);
        }
        $this->mock(LinkPreviewService::class, function ($mock) use ($linkPreviews): void {
            $mock->shouldReceive('previewForUrl')
                ->twice()
                ->andReturn(...$linkPreviews);
        });

        $commonPayload = [
            'buyer_product_note' => 'Social product',
            'requested_quantity' => 1,
            'seller_phone' => '+255763141335',
            'seller_phone_source' => 'public_post',
            'seller_contact_attested' => true,
        ];

        $this->actingAs($firstBuyer)->postJson('/api/social-commerce/requests', [
            ...$commonPayload,
            'original_url' => 'https://www.instagram.com/p/MATCH123/',
            'idempotency_key' => 'seller-match-1',
        ])->assertCreated();
        $firstRequest = SocialCommerceRequest::query()->where('idempotency_key', 'seller-match-1')->firstOrFail();
        $firstRequest->update([
            'claimed_merchant_id' => $merchant->id,
            'status' => SocialCommerceRequest::CLAIMED,
        ]);

        $secondResponse = $this->actingAs($secondBuyer)->postJson('/api/social-commerce/requests', [
            ...$commonPayload,
            'original_url' => 'https://www.instagram.com/p/MATCH456/',
            'idempotency_key' => 'seller-match-2',
        ])->assertCreated();

        $secondResponse->assertJsonPath('request.external_seller_handle', 'majengo_general_traders');
        $secondResponse->assertJsonPath('seller_match.match_type', 'known_takeer_merchant');
        $secondResponse->assertJsonPath('seller_match.handle', 'majengo_general_traders');
        $secondResponse->assertJsonPath('seller_match.merchant.display_name', 'Majengo Traders');
    }

    public function test_social_preview_returns_global_seller_phone_candidates_from_public_metadata(): void
    {
        $preview = LinkPreview::query()->create([
            'url_hash' => hash('sha256', 'https://instagram.com/p/PHONE123/'),
            'url' => 'https://instagram.com/p/PHONE123/',
            'final_url' => 'https://instagram.com/p/PHONE123/',
            'title' => 'Gasoline lawn mower',
            'description' => 'Contact +44 7911 123456 or WhatsApp 0763 141 335',
            'site_name' => 'Instagram',
            'status' => 'success',
            'fetched_at' => now(),
            'expires_at' => now()->addDay(),
        ]);
        $this->mock(LinkPreviewService::class, function ($mock) use ($preview): void {
            $mock->shouldReceive('previewForUrl')
                ->once()
                ->withArgs(fn (string $url, bool $refreshMissingImage): bool => $url === 'https://instagram.com/p/PHONE123/' && $refreshMissingImage)
                ->andReturn($preview);
        });

        $response = $this->postJson('/api/social-commerce/previews', [
            'url' => 'https://www.instagram.com/p/PHONE123/',
            'phone_region' => 'TZ',
        ])->assertOk();

        $response->assertJsonPath('contact_candidates.0.normalized', '+447911123456');
        $response->assertJsonPath('contact_candidates.0.country_iso2', 'GG');
        $response->assertJsonPath('contact_candidates.1.normalized', '+255763141335');
        $response->assertJsonPath('contact_candidates.1.country_iso2', 'TZ');
    }

    public function test_submitted_seller_phone_is_normalized_globally_before_storage(): void
    {
        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000021',
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/PHONE456/',
            'idempotency_key' => 'buyer-phone-request-1',
            'buyer_product_note' => 'Social mower',
            'requested_quantity' => 1,
            'seller_phone' => '0044 7911 123456',
            'seller_phone_source' => 'public_post',
            'seller_contact_attested' => true,
        ])->assertCreated();

        $request = SocialCommerceRequest::query()->firstOrFail();
        $this->assertSame('+447911123456', $request->sellerPhone());
        $this->assertSame('public_post', $request->seller_phone_source);
        $this->assertNotSame('+447911123456', $request->getRawOriginal('seller_phone_encrypted'));
    }

    public function test_sms_invitation_uses_the_normalized_number_after_buyer_attestation(): void
    {
        $buyer = User::factory()->create([
            'role' => 'buyer',
            'phone_number' => '+255700000031',
            'phone_verified_at' => now(),
        ]);

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests', [
            'original_url' => 'https://www.instagram.com/p/PHONE789/',
            'idempotency_key' => 'buyer-phone-request-2',
            'buyer_product_note' => 'Social mower',
            'requested_quantity' => 1,
            'seller_phone' => '0044 7911 123456',
            'seller_phone_source' => 'public_post',
            'seller_contact_attested' => true,
        ])->assertCreated();
        $request = SocialCommerceRequest::query()->firstOrFail();

        $this->mock(SocialCommerceNotificationService::class, function ($mock): void {
            $mock->shouldReceive('sendInvitation')
                ->once()
                ->withArgs(fn (SocialCommerceRequest $request, string $phone, string $message, string $dedupeKey): bool =>
                    $phone === '+447911123456'
                    && str_contains($message, 'https://www.instagram.com/p/PHONE789/')
                    && str_contains($message, '/social-buy/claim/')
                )
                ->andReturn(true);
        });

        $this->actingAs($buyer)->postJson('/api/social-commerce/requests/'.$request->public_id.'/invitations', [
            'channel' => 'sms',
            'recipient' => '0044 7911 123456',
            'seller_phone_region' => 'GB',
            'seller_contact_attested' => true,
        ])->assertCreated();

        $invitation = SocialCommerceRequestInvitation::query()->firstOrFail();
        $this->assertSame('+447911123456', $invitation->recipient_encrypted);
    }
}
