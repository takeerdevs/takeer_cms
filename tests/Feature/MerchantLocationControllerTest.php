<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantLocationControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_pickup_toggle_accepts_existing_uppercase_location_type(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'pickup-shop',
            'display_name' => 'Pickup Shop',
            'type' => 'business',
            'is_default' => true,
        ]);

        $location = MerchantLocation::create([
            'merchant_id' => $merchant->id,
            'name' => 'Main Shop',
            'type' => 'SHOP',
            'address' => 'Dar es Salaam',
            'latitude' => -6.7924,
            'longitude' => 39.2083,
            'allow_self_pickup' => true,
            'is_primary' => true,
        ]);

        $this->actingAs($user)->putJson("/api/merchant/locations/{$location->id}", [
            'merchant_id' => $merchant->id,
            'name' => 'Main Shop',
            'type' => 'SHOP',
            'address' => 'Dar es Salaam',
            'latitude' => -6.7924,
            'longitude' => 39.2083,
            'allow_self_pickup' => false,
            'is_primary' => true,
        ])->assertOk()
            ->assertJsonPath('data.allow_self_pickup', false);

        $this->assertDatabaseHas('merchant_locations', [
            'id' => $location->id,
            'type' => 'SHOP',
            'allow_self_pickup' => false,
        ]);
    }
}
