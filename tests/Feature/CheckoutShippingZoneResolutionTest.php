<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\CheckoutController;
use App\Models\Country;
use App\Models\Merchant;
use App\Models\MerchantLocation;
use App\Models\ShippingProfile;
use App\Models\ShippingZone;
use App\Models\User;
use App\Support\GeographyResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

class CheckoutShippingZoneResolutionTest extends TestCase
{
    use RefreshDatabase;

    public function test_same_city_shop_location_resolves_as_local_delivery(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        [$country, $state, $city] = $this->geography('Tanzania', 'TZ', 'Dar es Salaam', 'Dar es Salaam');

        $shop = MerchantLocation::create([
            'merchant_id' => $merchant->id,
            'country_id' => $country->id,
            'state_id' => $state->id,
            'city_id' => $city->id,
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
            buyerCountryId: $country->id,
            buyerStateId: $state->id,
            buyerCityId: $city->id,
        );

        $this->assertNull($error);
        $this->assertNull($hotspotId);
        $this->assertTrue($localZone->is($zone));
    }

    public function test_outside_local_delivery_resolves_matching_intercity_destination(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        [$country, $mwanzaState, $mwanzaCity] = $this->geography('Tanzania', 'TZ', 'Mwanza', 'Mwanza');
        [, $shinyangaState, $shinyangaCity] = $this->geography('Tanzania', 'TZ', 'Shinyanga', 'Shinyanga');

        $mwanza = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Mwanza',
            'flat_rate_fee' => 20000,
            'destination_city' => 'Mwanza',
            'destination_region' => 'Mwanza',
            'destination_country_id' => $country->id,
            'destination_state_id' => $mwanzaState->id,
            'destination_city_id' => $mwanzaCity->id,
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
            'destination_country_id' => $country->id,
            'destination_state_id' => $shinyangaState->id,
            'destination_city_id' => $shinyangaCity->id,
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
            buyerCountryId: $country->id,
            buyerStateId: $shinyangaState->id,
            buyerCityId: $shinyangaCity->id,
        );

        $this->assertNull($error);
        $this->assertTrue($shinyanga->is($zone));
        $this->assertNull($hotspotId);
    }

    public function test_block_policy_rejects_customer_outside_intercity_pickup_area(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        [$country, $state, $city] = $this->geography('Tanzania', 'TZ', 'Shinyanga', 'Shinyanga');
        [, $mwanzaState, $mwanzaCity] = $this->geography('Tanzania', 'TZ', 'Mwanza', 'Mwanza');
        $profile->update([
            'outside_area_policy' => 'block',
            'international_enabled' => true,
        ]);

        $shinyanga = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Shinyanga',
            'flat_rate_fee' => 18000,
            'destination_city' => 'Shinyanga',
            'destination_region' => 'Shinyanga',
            'destination_country_id' => $country->id,
            'destination_state_id' => $state->id,
            'destination_city_id' => $city->id,
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
            buyerCountryId: $country->id,
            buyerStateId: $mwanzaState->id,
            buyerCityId: $mwanzaCity->id,
        );

        $this->assertNull($zone);
        $this->assertNull($hotspotId);
        $this->assertIsString($error);
        $this->assertStringContainsString('Shinyanga', $error);
    }

    public function test_block_policy_allows_customer_inside_intercity_pickup_city(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        [$country, $state, $city] = $this->geography('Tanzania', 'TZ', 'Shinyanga', 'Shinyanga');
        $profile->update([
            'outside_area_policy' => 'block',
            'international_enabled' => true,
        ]);

        $shinyanga = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Shinyanga',
            'flat_rate_fee' => 18000,
            'destination_city' => 'Shinyanga',
            'destination_region' => 'Shinyanga',
            'destination_country_id' => $country->id,
            'destination_state_id' => $state->id,
            'destination_city_id' => $city->id,
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
            buyerCountryId: $country->id,
            buyerStateId: $state->id,
            buyerCityId: $city->id,
        );

        $this->assertNull($error);
        $this->assertTrue($shinyanga->is($zone));
        $this->assertNull($hotspotId);
    }

    public function test_countrywide_intercity_zone_covers_customer_inside_business_country(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        [$country] = $this->geography('Tanzania', 'TZ', 'Mbeya', 'Mbeya');
        $profile->update(['outside_area_policy' => 'block']);

        $countrywide = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'Nchi nzima - Tanzania',
            'flat_rate_fee' => 15000,
            'destination_country' => 'Tanzania',
            'destination_country_id' => $country->id,
            'delivery_type' => 'intercity_bus',
            'coverage_scope' => 'countrywide',
            'is_active' => true,
        ]);

        [$zone, $error, $hotspotId] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: -8.9,
            buyerLng: 33.45,
            buyerCity: 'Mbeya',
            buyerRegion: 'Mbeya',
            buyerCountry: 'Tanzania',
            buyerCountryId: $country->id,
        );

        $this->assertNull($error);
        $this->assertTrue($countrywide->is($zone));
        $this->assertNull($hotspotId);
    }

    public function test_international_zone_only_matches_its_destination_country(): void
    {
        [$merchant, $profile] = $this->merchantWithProfile();
        [$kenyaCountry] = $this->geography('Kenya', 'KE', 'Nairobi', 'Nairobi');
        [$ugandaCountry] = $this->geography('Uganda', 'UG', 'Central', 'Kampala');
        $profile->update([
            'outside_area_policy' => 'block',
            'international_enabled' => true,
        ]);

        $kenya = ShippingZone::create([
            'merchant_id' => $merchant->id,
            'shipping_profile_id' => $profile->id,
            'zone_name' => 'International - Kenya',
            'flat_rate_fee' => 30000,
            'destination_country' => 'Kenya',
            'destination_country_id' => $kenyaCountry->id,
            'delivery_type' => 'intercity_bus',
            'coverage_scope' => 'international',
            'is_active' => true,
        ]);

        [$zone, $error] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: -1.29,
            buyerLng: 36.82,
            buyerCity: 'Nairobi',
            buyerRegion: 'Nairobi',
            buyerCountry: 'Kenya',
            buyerCountryId: $kenyaCountry->id,
        );

        $this->assertNull($error);
        $this->assertTrue($kenya->is($zone));

        [$zone, $error] = $this->resolveZone(
            zoneId: null,
            shippingProfileId: $profile->id,
            merchantId: $merchant->id,
            buyerLat: 0.35,
            buyerLng: 32.58,
            buyerCity: 'Kampala',
            buyerRegion: 'Central',
            buyerCountry: 'Uganda',
            buyerCountryId: $ugandaCountry->id,
        );

        $this->assertNull($zone);
        $this->assertIsString($error);
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

    private function geography(string $countryName, string $iso2, string $stateName, string $cityName): array
    {
        $country = Country::firstOrCreate(
            ['iso_alpha2' => $iso2],
            ['name' => $countryName, 'phone_code' => '000']
        );
        $geo = app(GeographyResolver::class)->resolve(
            countryId: $country->id,
            stateName: $stateName,
            cityName: $cityName,
        );
        $state = \App\Models\CountryState::find($geo['state_id']);
        $city = \App\Models\CountryCity::find($geo['city_id']);

        return [$country, $state, $city];
    }

    private function resolveZone(?int $zoneId, int $shippingProfileId, int $merchantId, float $buyerLat, float $buyerLng, string $buyerCity, string $buyerRegion = '', ?string $buyerCountry = null, ?int $buyerCountryId = null, ?int $buyerStateId = null, ?int $buyerCityId = null): array
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
            $buyerCountry,
            $buyerCountryId,
            $buyerStateId,
            $buyerCityId,
        );
    }
}
