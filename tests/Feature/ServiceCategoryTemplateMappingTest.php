<?php

namespace Tests\Feature;

use App\Models\ServiceCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceCategoryTemplateMappingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_category_with_allowed_service_templates(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($admin)->postJson('/admin/api/service-categories', [
            'name' => 'Home & Repairs',
            'service_template_key' => 'appointment_or_quote',
            'allowed_template_keys' => ['appointment_or_quote', 'rental'],
            'template_rules' => [
                'rental' => [
                    'required_documents' => ['identity', 'ownership_proof'],
                    'subtypes' => [
                        'vehicle' => [
                            'required_documents' => ['identity', 'business_license', 'vehicle_registration', 'insurance'],
                        ],
                    ],
                ],
            ],
            'required_documents' => ['identity'],
        ]);

        $response->assertCreated()
            ->assertJsonPath('category.default_template_key', 'appointment_or_quote')
            ->assertJsonPath('category.allowed_template_keys.0', 'appointment_or_quote')
            ->assertJsonPath('category.allowed_template_keys.1', 'rental')
            ->assertJsonPath('category.allowed_templates.1.key', 'rental')
            ->assertJsonPath('category.allowed_templates.1.subtypes.0.key', 'none')
            ->assertJsonPath('category.allowed_templates.1.subtypes.1.key', 'tools_equipment')
            ->assertJsonPath('category.template_rules.rental.required_documents.1', 'ownership_proof');

        $this->assertDatabaseHas('service_categories', [
            'name' => 'Home & Repairs',
            'service_template_key' => 'appointment_or_quote',
        ]);
    }

    public function test_public_category_index_returns_system_templates_and_allowed_templates(): void
    {
        ServiceCategory::create([
            'name' => 'Events',
            'slug' => 'events',
            'service_template_key' => 'space_booking',
            'allowed_template_keys' => ['space_booking', 'rental'],
            'required_documents' => ['identity'],
        ]);

        $response = $this->getJson('/api/service-categories');

        $response->assertOk()
            ->assertJsonPath('service_templates.rental.key', 'rental')
            ->assertJsonPath('service_templates.rental.subtypes.0.key', 'none')
            ->assertJsonPath('service_templates.rental.subtypes.2.key', 'vehicle')
            ->assertJsonPath('data.0.default_template_key', 'space_booking')
            ->assertJsonPath('data.0.allowed_templates.0.key', 'space_booking')
            ->assertJsonPath('data.0.allowed_templates.1.key', 'rental')
            ->assertJsonPath('data.0.allowed_templates.1.subtypes.3.key', 'event_equipment');
    }
}
