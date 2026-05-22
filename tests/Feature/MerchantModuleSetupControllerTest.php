<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantModuleSetupControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_retail_ops_is_not_returned_as_configurable_business_module(): void
    {
        $user = User::factory()->create();
        Merchant::create([
            'user_id' => $user->id,
            'username' => 'settings-shop',
            'display_name' => 'Settings Shop',
            'type' => 'business',
            'active_modules' => ['products', 'retail_ops'],
            'business_profile' => [
                'recommended_modules' => ['products', 'retail_ops', 'bookkeeping'],
            ],
        ]);

        $response = $this->actingAs($user)->getJson('/merchant/settings-shop/modules/api');

        $response->assertOk()
            ->assertJsonMissingPath('business_modules.retail_ops')
            ->assertJsonPath('merchant.active_modules', ['products'])
            ->assertJsonPath('recommended_modules', ['products', 'bookkeeping']);
    }

    public function test_saving_configurable_modules_preserves_existing_retail_ops_access(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'retail-preserved',
            'display_name' => 'Retail Preserved',
            'type' => 'business',
            'active_modules' => ['products', 'retail_ops'],
            'business_profile' => [
                'commerce_modes' => [],
            ],
        ]);

        $this->actingAs($user)->putJson('/merchant/retail-preserved/modules/api', [
            'active_modules' => ['bookkeeping'],
            'commerce_modes' => [],
        ])->assertOk()
            ->assertJsonPath('merchant.active_modules', ['bookkeeping']);

        $this->assertSame(['bookkeeping', 'retail_ops'], $merchant->fresh()->active_modules);
    }

    public function test_business_settings_save_preserves_existing_retail_ops_access(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'settings-preserved',
            'display_name' => 'Settings Preserved',
            'type' => 'business',
            'active_modules' => ['products', 'retail_ops'],
            'business_profile' => [
                'commerce_modes' => [],
            ],
        ]);

        $this->actingAs($user)->post('/merchant/settings-preserved/settings', [
            'display_name' => 'Settings Preserved',
            'bio' => null,
            'country_id' => null,
            'currency_id' => null,
            'timezone' => null,
            'avatar_url' => null,
            'business_category_key' => null,
            'business_subcategory_key' => null,
            'business_profile' => [
                'commerce_modes' => [],
            ],
            'active_modules' => ['bookkeeping'],
            'allow_post_comments' => true,
            'allow_post_reactions' => true,
        ])->assertRedirect();

        $this->assertSame(['bookkeeping', 'retail_ops'], $merchant->fresh()->active_modules);
    }
}
