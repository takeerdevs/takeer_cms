<?php

namespace Tests\Feature;

use App\Jobs\ProcessTryOnSession;
use App\Models\Merchant;
use App\Models\Product;
use App\Models\ProductTryOnAsset;
use App\Models\TryOnSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VirtualTryOnTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_start_a_try_on_session_and_receive_a_private_poll_token(): void
    {
        Queue::fake();
        $product = $this->tryOnProduct();

        $response = $this->post('/api/try-on/products/'.$product->slug.'/sessions', [
            'portrait' => UploadedFile::fake()->image('portrait.jpg', 700, 900),
            'consent' => '1',
        ]);

        $response->assertStatus(202)
            ->assertJsonPath('status', 'pending')
            ->assertJsonStructure(['session_id', 'token', 'poll_url', 'expires_at']);

        $session = TryOnSession::query()->firstOrFail();
        $this->assertTrue($session->hasAccessToken($response->json('token')));
        $this->assertDatabaseHas('try_on_sessions', [
            'public_id' => $response->json('session_id'),
            'product_id' => $product->id,
            'status' => 'pending',
        ]);
        Queue::assertPushed(ProcessTryOnSession::class, fn ($job) => $job->tryOnSessionId === $session->id);
    }

    public function test_fake_provider_processes_a_portrait_and_result_is_token_protected(): void
    {
        Storage::fake('local');
        config(['services.try_on.driver' => 'fake', 'services.try_on.storage_disk' => 'local']);
        $product = $this->tryOnProduct();
        Storage::disk('local')->put('try-on/portraits/input.jpg', UploadedFile::fake()->image('portrait.jpg', 700, 900)->getContent());
        Storage::disk('local')->put('try-on/garments/garment.png', UploadedFile::fake()->image('garment.png', 500, 500)->getContent());
        $asset = ProductTryOnAsset::create([
            'product_id' => $product->id,
            'disk' => 'local',
            'garment_path' => 'try-on/garments/garment.png',
            'mime' => 'image/png',
            'is_active' => true,
        ]);
        $token = 'test-token-'.str_repeat('x', 20);
        $session = TryOnSession::create([
            'product_id' => $product->id,
            'access_token_hash' => hash('sha256', $token),
            'portrait_disk' => 'local',
            'portrait_path' => 'try-on/portraits/input.jpg',
            'portrait_mime' => 'image/jpeg',
            'status' => 'pending',
            'expires_at' => now()->addHour(),
        ]);

        ProcessTryOnSession::dispatchSync($session->id);
        $session->refresh();

        $this->assertSame('completed', $session->status);
        $this->assertNotEmpty($session->result_path);
        Storage::disk('local')->assertExists($session->result_path);
        Storage::disk('local')->assertMissing('try-on/portraits/input.jpg');

        $this->getJson('/api/try-on/sessions/'.$session->public_id.'?token='.$token)
            ->assertOk()
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('session_id', $session->public_id);

        $this->get('/api/try-on/sessions/'.$session->public_id.'/result?token='.$token)
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg');

        $this->get('/api/try-on/assets/'.$asset->id.'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');

        $this->getJson('/api/try-on/sessions/'.$session->public_id.'?token=wrong-token')
            ->assertForbidden();

        $this->assertTrue($asset->fresh()->is_active);
    }

    private function tryOnProduct(): Product
    {
        $user = User::factory()->create(['role' => 'merchant']);
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'try-on-merchant-'.uniqid(),
            'display_name' => 'Try On Merchant',
            'is_default' => true,
            'is_active' => true,
        ]);

        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Try On Shirt',
            'slug' => 'try-on-shirt-'.uniqid(),
            'type' => 'physical',
            'price' => 25000,
            'inventory_count' => 10,
            'try_on_enabled' => true,
        ]);

        ProductTryOnAsset::create([
            'product_id' => $product->id,
            'disk' => 'local',
            'garment_path' => 'try-on/garments/placeholder.png',
            'mime' => 'image/png',
            'is_active' => true,
        ]);

        return $product;
    }
}
