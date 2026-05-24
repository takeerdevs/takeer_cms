<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\CheckoutController;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Models\ShippingProfile;
use App\Models\ShippingZone;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

class CheckoutShippingZoneResolutionTest extends TestCase
{
    use RefreshDatabase;

    public function test_same_city_shop_location_resolves_as_local_delivery(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();

        $shop = MerchantLocation::create([
            'merchant_id' => $merchant->id,
            'name' => 'Kariakoo Shop',
            'address' => 'Kariakoo',
            'latitude' => -6.8235,
            'longitude' => 39.2695,
            'city' => 'Dar es Salaam',
            'region' => 'Dar es Salaam',
        ]);

        $localZone = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'merchant_location_id' => $shop->id,
            'zone_name' => 'Dar local delivery',
            'flat_rate_fee' => 5000,
            'max_distance_km' => 3,
            'delivery_type' => 'local_boda',
            'is_active' => true,
        ]);

        $intercityZone = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Morogoro',
            'flat_rate_fee' => 10000,
            'destination_city' => 'Morogoro',
            'destination_region' => 'Morogoro',
            'reference_lat' => -6.8278,
            'reference_lng' => 37.6614,
            'delivery_type' => 'intercity_bus',
            'is_active' => true,
        ]);

        [$zone, $error, $hotspotId] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: -6.65,
            buyerLng: 39.18,
            buyerCity: 'Dar es Salaam',
        );

        $this->assertNull($error);
        $this->assertNull($hotspotId);
        $this->assertTrue($localZone->is($zone));
    }

    public function test_outside_local_delivery_resolves_nearest_intercity_destination_when_allowed(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();

        $mwanza = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Mwanza',
            'flat_rate_fee' => 20000,
            'destination_city' => 'Mwanza',
            'destination_region' => 'Mwanza',
            'reference_lat' => -2.5164,
            'reference_lng' => 32.9175,
            'delivery_type' => 'intercity_bus',
            'is_active' => true,
        ]);

        $shinyanga = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Shinyanga',
            'flat_rate_fee' => 18000,
            'destination_city' => 'Shinyanga',
            'destination_region' => 'Shinyanga',
            'reference_lat' => -3.6639,
            'reference_lng' => 33.4212,
            'delivery_type' => 'intercity_bus',
            'is_active' => true,
        ]);

        [$zone, $error, $hotspotId] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: -3.66,
            buyerLng: 33.42,
            buyerCity: 'Kahama',
        );

        $this->assertNull($error);
        $this->assertTrue($shinyanga->is($zone));
        $this->assertNull($hotspotId);
    }

    public function test_block_policy_rejects_customer_outside_intercity_pickup_area(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        $profile->update(['outside_area_policy' => 'block']);

        $shinyanga = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Shinyanga',
            'flat_rate_fee' => 18000,
            'destination_city' => 'Shinyanga',
            'destination_region' => 'Shinyanga',
            'reference_lat' => -3.6639,
            'reference_lng' => 33.4212,
            'delivery_type' => 'intercity_bus',
            'is_active' => true,
        ]);

        [$zone, $error, $hotspotId] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: -2.5164,
            buyerLng: 32.9175,
            buyerCity: 'Mwanza',
            buyerRegion: 'Mwanza',
        );

        $this->assertNull($zone);
        $this->assertNull($hotspotId);
        $this->assertIsString($error);
        $this->assertStringContainsString('Shinyanga', $error);
    }

    public function test_block_policy_allows_customer_inside_intercity_pickup_city(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        $profile->update(['outside_area_policy' => 'block']);

        $shinyanga = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Shinyanga',
            'flat_rate_fee' => 18000,
            'destination_city' => 'Shinyanga',
            'destination_region' => 'Shinyanga',
            'reference_lat' => -3.6639,
            'reference_lng' => 33.4212,
            'delivery_type' => 'intercity_bus',
            'is_active' => true,
        ]);

        [$zone, $error, $hotspotId] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: -3.66,
            buyerLng: 33.42,
            buyerCity: 'Shinyanga',
            buyerRegion: 'Shinyanga',
        );

        $this->assertNull($error);
        $this->assertTrue($shinyanga->is($zone));
        $this->assertNull($hotspotId);
    }

    private function merchantWithProfile(): array
    {
        $user = User::factory()->create();
        $merchant = Merchant::create([
            'user_id' => $user->id,
            'username' => 'shipping-test-' . uniqid(),
            'display_name' => 'Shipping Test',
            'type' => 'business',
            'is_default' => true,
        ]);

        $profile = ShippingProfile::create([
            'merchant_id' => $merchant->id,
            'name' => 'Default Shipping',
            'is_default' => true,
        ]);

        return [$merchant, $profile];
    }

    private function resolveZone(?int $zoneId, int $shippingProfileId, int $merchantId, float $buyerLat, float $buyerLng, string $buyerCity, string $buyerRegion = ''): array
    {
        $controller = app(CheckoutController::class);
        $method = new ReflectionMethod($controller, 'resolveCheckoutShippingZone');
        $method->setAccessible(true);

        return $method->invoke(
            $controller,
            $zoneId,
            $shippingProfileId,
            $merchantId,
            $buyerLat,
            $buyerLng,
            $buyerCity,
            $buyerRegion,
            null,
        );
    }
}
