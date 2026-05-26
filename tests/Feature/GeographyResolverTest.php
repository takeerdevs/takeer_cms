<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Support\GeographyResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GeographyResolverTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_reuses_normalized_state_and_city_inside_country_hierarchy(): void
    {
        $tanzania = Country::create([
            'name' => 'Tanzania',
            'iso_alpha2' => 'TZ',
            'phone_code' => '255',
        ]);

        $resolver = app(GeographyResolver::class);

        $first = $resolver->resolve(
            countryIso2: 'TZ',
            stateName: 'Dar es Salaam Region',
            cityName: 'Dar-es-Salaam City',
        );

        $second = $resolver->resolve(
            countryId: $tanzania->id,
            stateName: 'dar es salaam',
            cityName: 'Dar es Salaam',
        );

        $this->assertSame($first['country_id'], $second['country_id']);
        $this->assertSame($first['state_id'], $second['state_id']);
        $this->assertSame($first['city_id'], $second['city_id']);
        $this->assertDatabaseCount('country_states', 1);
        $this->assertDatabaseCount('country_cities', 1);
    }

    public function test_same_city_name_can_exist_under_different_countries(): void
    {
        Country::create(['name' => 'Tanzania', 'iso_alpha2' => 'TZ', 'phone_code' => '255']);
        Country::create(['name' => 'Kenya', 'iso_alpha2' => 'KE', 'phone_code' => '254']);

        $resolver = app(GeographyResolver::class);

        $tz = $resolver->resolve(countryIso2: 'TZ', stateName: 'Arusha', cityName: 'Arusha');
        $ke = $resolver->resolve(countryIso2: 'KE', stateName: 'Arusha', cityName: 'Arusha');

        $this->assertNotSame($tz['state_id'], $ke['state_id']);
        $this->assertNotSame($tz['city_id'], $ke['city_id']);
        $this->assertDatabaseCount('country_states', 2);
        $this->assertDatabaseCount('country_cities', 2);
    }
}
