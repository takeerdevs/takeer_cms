<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantBusinessOperationSetupTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_create_business_profile_with_operations_without_category(): void
    {
        $user = User::factory()->create([
            'role' => 'merchant',
            'phone_number' => '255700111222',
            'phone_verified_at' => now(),
        ]);

        Merchant::create([
            'user_id' => $user->id,
            'username' => 'asha-personal',
            'display_name' => 'Asha Personal',
            'type' => 'personal',
            'is_default' => true,
        ]);

        $response = $this->actingAs($user)->postJson('/merchant/add-business', [
            'display_name' => 'Asha General Traders',
            'username' => 'asha-general-traders',
            'type' => 'business',
            'primary_operation' => 'physical_products',
            'operations' => ['physical_products', 'custom_orders'],
        ]);

        $response->assertOk()
            ->assertJsonPath('merchant.business_category_key', null)
            ->assertJsonPath('merchant.business_subcategory_key', null)
            ->assertJsonPath('merchant.business_profile.primary_operation', 'physical_products')
            ->assertJsonPath('merchant.business_profile.operations.0', 'physical_products');

        $this->assertDatabaseHas('merchants', [
            'username' => 'asha-general-traders',
            'type' => 'business',
            'business_category_key' => null,
            'business_subcategory_key' => null,
        ]);

        $merchant = Merchant::query()->where('username', 'asha-general-traders')->firstOrFail();
        $this->assertContains('products', $merchant->business_profile['recommended_modules']);
        $this->assertContains('custom_orders', $merchant->business_profile['recommended_modules']);
        $this->assertContains('physical_products', $merchant->business_profile['commerce_modes']);
    }
}
