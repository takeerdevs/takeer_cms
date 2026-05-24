<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\ShippingProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantShippingProfileScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_shipping_profiles_are_scoped_to_requested_merchant(): void
    {
        $user = User::factory()->create();

        $defaultMerchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'default-shop',
            'display_name' => 'Default Shop',
            'type' => 'business',
            'is_default' => true,
        ]);

        $newMerchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'new-shop',
            'display_name' => 'New Shop',
            'type' => 'business',
            'is_default' => false,
        ]);

        ShippingProfile::create([
            'merchant_id' => $defaultMerchant->id,
            'name' => 'Old Business Delivery',
            'is_default' => true,
        ]);

        ShippingProfile::create([
            'merchant_id' => $newMerchant->id,
            'name' => 'New Business Delivery',
            'is_default' => true,
        ]);

        $response = $this->actingAs($user)
            ->getJson("/api/merchant/shipping-profiles?merchant_id={$newMerchant->id}");

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'New Business Delivery');
    }

    public function test_shipping_profile_creation_uses_requested_merchant(): void
    {
        $user = User::factory()->create();

        $defaultMerchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'default-create-shop',
            'display_name' => 'Default Create Shop',
            'type' => 'business',
            'is_default' => true,
        ]);

        $newMerchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'new-create-shop',
            'display_name' => 'New Create Shop',
            'type' => 'business',
            'is_default' => false,
        ]);

        $this->actingAs($user)->postJson('/api/merchant/shipping-profiles', [
            'merchant_id' => $newMerchant->id,
            'name' => 'Dar es Salaam mjini',
        ])->assertOk()
            ->assertJsonPath('data.merchant_id', $newMerchant->id);

        $this->assertDatabaseMissing('shipping_profiles', [
            'merchant_id' => $defaultMerchant->id,
            'name' => 'Dar es Salaam mjini',
        ]);
    }
}
