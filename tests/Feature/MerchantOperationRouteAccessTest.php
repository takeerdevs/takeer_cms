<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MerchantOperationRouteAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_operation_based_business_can_open_menu_without_active_menu_module(): void
    {
        $user = User::factory()->create();
        Merchant::create([
            'user_id' => $user->id,
            'username' => 'food-place',
            'display_name' => 'Food Place',
            'type' => 'business',
            'is_default' => true,
            'business_profile' => [
                'primary_operation' => 'food_menu',
                'operations' => ['food_menu'],
                'commerce_modes' => ['food_menu'],
            ],
            'active_modules' => [],
        ]);

        $this->actingAs($user)
            ->get('/merchant/food-place/menu')
            ->assertOk();
    }

    public function test_operation_based_business_can_open_enrollments_without_active_enrollments_module(): void
    {
        $user = User::factory()->create();
        Merchant::create([
            'user_id' => $user->id,
            'username' => 'training-place',
            'display_name' => 'Training Place',
            'type' => 'business',
            'is_default' => true,
            'business_profile' => [
                'primary_operation' => 'education_training',
                'operations' => ['education_training'],
                'commerce_modes' => ['courses_learning'],
            ],
            'active_modules' => [],
        ]);

        $this->actingAs($user)
            ->get('/merchant/training-place/enrollments')
            ->assertOk();
    }
}
