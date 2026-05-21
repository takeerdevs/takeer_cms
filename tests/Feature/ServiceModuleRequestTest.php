<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\Product;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceModuleRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_tour_request_creates_service_request_with_module_payload(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'safari-team',
            'display_name' => 'Safari Team',
            'is_default' => true,
            'active_modules' => ['tour_departures', 'bookings'],
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Mikumi Weekend Safari',
            'slug' => 'mikumi-weekend-safari',
            'type' => 'service',
            'module_key' => 'tour_departures',
            'module_details' => [
                'destination' => 'Mikumi',
                'duration_label' => '2 days',
                'group_size' => 4,
            ],
            'price' => 120000,
            'service_mode' => 'request_quote',
            'service_price_display' => 'per_person',
            'service_duration_minutes' => 2880,
            'service_location_type' => 'provider_location',
        ]);

        $response = $this->postJson('/api/service-requests', [
            'product_id' => $product->id,
            'request_type' => 'tour_booking_request',
            'customer_name' => 'Asha Customer',
            'customer_phone' => '255700000000',
            'preferred_date' => now()->addDays(5)->toDateString(),
            'module_payload' => [
                'tour_guests' => 3,
            ],
            'message' => 'We need pickup from Morogoro.',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.request_type', 'tour_booking_request')
            ->assertJsonPath('data.client_requirements.module_payload.tour_guests', 3);

        $this->assertDatabaseHas('service_requests', [
            'merchant_id' => $merchant->id,
            'product_id' => $product->id,
            'request_type' => 'tour_booking_request',
            'customer_name' => 'Asha Customer',
        ]);

        $request = ServiceRequest::firstOrFail();
        $this->assertSame(3, $request->metadata['module_payload']['tour_guests']);
        $this->assertSame('tour_departures', $request->metadata['module_key']);
    }

    public function test_tour_request_rejects_group_size_above_capacity(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'small-tour',
            'display_name' => 'Small Tour',
            'is_default' => true,
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Small Group Trip',
            'slug' => 'small-group-trip',
            'type' => 'service',
            'module_key' => 'tour_departures',
            'module_details' => ['group_size' => 2],
            'price' => 50000,
            'service_mode' => 'request_quote',
            'service_price_display' => 'per_person',
        ]);

        $this->postJson('/api/service-requests', [
            'product_id' => $product->id,
            'request_type' => 'tour_booking_request',
            'customer_name' => 'Asha Customer',
            'customer_phone' => '255700000000',
            'module_payload' => ['tour_guests' => 3],
        ])->assertStatus(422);
    }

    public function test_instant_booking_request_is_confirmed_and_gets_payment_link_for_deposit(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'instant-booker',
            'display_name' => 'Instant Booker',
            'is_default' => true,
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Instant Consultation',
            'slug' => 'instant-consultation',
            'type' => 'service',
            'price' => 100000,
            'service_mode' => 'book_appointment',
            'service_booking_type' => 'instant',
            'service_deposit_amount' => 30000,
            'service_price_display' => 'fixed',
            'service_duration_minutes' => 60,
            'service_location_type' => 'provider_location',
        ]);

        $response = $this->postJson('/api/service-requests', [
            'product_id' => $product->id,
            'request_type' => 'appointment_request',
            'customer_name' => 'Asha Customer',
            'customer_phone' => '255700000000',
            'preferred_date' => now()->addDays(2)->toDateString(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.payment_status', 'payment_link_created')
            ->assertJsonPath('data.quoted_amount', 30000)
            ->assertJsonPath('data.deposit_amount', 30000)
            ->assertJsonPath('data.payment_summary.total_amount', 100000)
            ->assertJsonPath('data.payment_summary.advance_amount', 30000)
            ->assertJsonPath('data.payment_summary.remaining_amount', 100000)
            ->assertJsonPath('data.payment_summary.is_advance_payment', true);

        $this->assertNotNull($response->json('data.payment_url'));
        $this->assertDatabaseHas('service_requests', [
            'product_id' => $product->id,
            'status' => 'confirmed',
            'payment_status' => 'payment_link_created',
            'quoted_amount' => 30000,
            'deposit_amount' => 30000,
        ]);
    }

    public function test_manual_confirm_request_waits_for_merchant_before_payment_link(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'manual-booker',
            'display_name' => 'Manual Booker',
            'is_default' => true,
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Manual Consultation',
            'slug' => 'manual-consultation',
            'type' => 'service',
            'price' => 100000,
            'service_mode' => 'book_appointment',
            'service_booking_type' => 'manual_confirm',
            'service_deposit_amount' => 30000,
            'service_price_display' => 'fixed',
            'service_duration_minutes' => 60,
            'service_location_type' => 'provider_location',
        ]);

        $response = $this->postJson('/api/service-requests', [
            'product_id' => $product->id,
            'request_type' => 'appointment_request',
            'customer_name' => 'Asha Customer',
            'customer_phone' => '255700000000',
            'preferred_date' => now()->addDays(2)->toDateString(),
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.payment_status', null)
            ->assertJsonPath('data.payment_url', null)
            ->assertJsonPath('data.deposit_amount', 30000);
    }

    public function test_merchant_can_record_room_fulfillment(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'stay-owner',
            'display_name' => 'Stay Owner',
            'is_default' => true,
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Ocean Room',
            'slug' => 'ocean-room',
            'type' => 'service',
            'module_key' => 'rooms',
            'module_details' => ['room_type' => 'Double', 'availability' => ['available']],
            'price' => 80000,
            'service_mode' => 'request_quote',
            'service_price_display' => 'nightly',
        ]);
        $serviceRequest = ServiceRequest::create([
            'merchant_id' => $merchant->id,
            'product_id' => $product->id,
            'request_type' => 'room_booking_request',
            'status' => 'pending',
            'customer_name' => 'Asha Customer',
            'customer_phone' => '255700000000',
            'metadata' => ['module_key' => 'rooms', 'module_payload' => ['stay_nights' => 2]],
        ]);

        $response = $this->actingAs($user)->patchJson("/merchant/{$merchant->username}/service-requests/{$serviceRequest->id}/fulfillment", [
            'action' => 'confirm',
            'fulfillment_status' => 'reserved',
            'fields' => [
                'room_number' => '204',
                'guests' => 2,
            ],
            'notes' => 'Late check-in accepted.',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.module_fulfillment.status', 'reserved')
            ->assertJsonPath('data.module_fulfillment.fields.room_number', '204');

        $serviceRequest->refresh();
        $this->assertSame('confirmed', $serviceRequest->status);
        $this->assertDatabaseHas('service_request_fulfillments', [
            'service_request_id' => $serviceRequest->id,
            'module_key' => 'rooms',
            'status' => 'reserved',
            'room_number' => '204',
            'guests' => 2,
        ]);
        $this->assertDatabaseHas('service_request_fulfillment_events', [
            'service_request_id' => $serviceRequest->id,
            'module_key' => 'rooms',
            'status' => 'reserved',
            'action' => 'confirm',
        ]);
    }

    public function test_merchant_can_complete_custom_order_fulfillment(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'print-shop',
            'display_name' => 'Print Shop',
            'is_default' => true,
        ]);
        $product = Product::create([
            'merchant_id' => $merchant->id,
            'title' => 'Custom Banner',
            'slug' => 'custom-banner',
            'type' => 'service',
            'module_key' => 'custom_orders',
            'module_details' => ['quote_policy' => 'quote_after_request'],
            'price' => 0,
            'service_mode' => 'request_quote',
            'service_price_display' => 'quote_only',
        ]);
        $serviceRequest = ServiceRequest::create([
            'merchant_id' => $merchant->id,
            'product_id' => $product->id,
            'request_type' => 'custom_order_request',
            'status' => 'confirmed',
            'customer_name' => 'Asha Customer',
            'customer_phone' => '255700000000',
            'metadata' => ['module_key' => 'custom_orders'],
        ]);

        $response = $this->actingAs($user)->patchJson("/merchant/{$merchant->username}/service-requests/{$serviceRequest->id}/fulfillment", [
            'action' => 'complete',
            'fulfillment_status' => 'delivered',
            'fields' => [
                'reference_code' => 'JOB-1001',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.delivery_status', 'provider_marked_delivered')
            ->assertJsonPath('data.module_fulfillment.fields.reference_code', 'JOB-1001');

        $this->assertDatabaseHas('service_request_fulfillments', [
            'service_request_id' => $serviceRequest->id,
            'module_key' => 'custom_orders',
            'status' => 'delivered',
            'reference_code' => 'JOB-1001',
        ]);
        $this->assertDatabaseHas('service_request_fulfillment_events', [
            'service_request_id' => $serviceRequest->id,
            'module_key' => 'custom_orders',
            'status' => 'delivered',
            'action' => 'complete',
        ]);
    }
}
