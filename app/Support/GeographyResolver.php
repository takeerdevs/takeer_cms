<?php

namespace App\Support;

use App\Models\Country;
use App\Models\CountryCity;
use App\Models\CountryState;
use Illuminate\Support\Str;

class GeographyResolver
{
    public function resolve(?int $countryId = null, ?string $countryIso2 = null, ?string $countryName = null, ?int $stateId = null, ?string $stateName = null, ?int $cityId = null, ?string $cityName = null): array
    {
        $country = $this->country($countryId, $countryIso2, $countryName);
        $state = $country ? $this->state($country, $stateId, $stateName) : null;
        $city = $country ? $this->city($country, $state, $cityId, $cityName) : null;

        return [
            'country_id' => $country?->id,
            'state_id' => $state?->id,
            'city_id' => $city?->id,
            'country_name' => $country?->name,
            'state_name' => $state?->name,
            'city_name' => $city?->name,
        ];
    }

    public function country(?int $countryId = null, ?string $iso2 = null, ?string $name = null): ?Country
    {
        if ($countryId) {
            return Country::find($countryId);
        }

        $iso2 = strtoupper(trim((string) $iso2));
        if ($iso2 !== '') {
            $country = Country::query()->where('iso_alpha2', $iso2)->first();
            if ($country) {
                return $country;
            }
        }

        $name = trim((string) $name);
        if ($name === '') {
            return null;
        }

        return Country::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();
    }

    private function state(Country $country, ?int $stateId, ?string $name): ?CountryState
    {
        if ($stateId) {
            return CountryState::query()
                ->where('country_id', $country->id)
                ->find($stateId);
        }

        $displayName = $this->displayName($name);
        $normalizedName = $this->normalizedName($displayName);
        if ($displayName === '' || $normalizedName === '') {
            return null;
        }

        $state = CountryState::query()
            ->where('country_id', $country->id)
            ->where('normalized_name', $normalizedName)
            ->first();

        if ($state) {
            return $state;
        }

        return CountryState::create([
            'country_id' => $country->id,
            'name' => $displayName,
            'normalized_name' => $normalizedName,
        ]);
    }

    private function city(Country $country, ?CountryState $state, ?int $cityId, ?string $name): ?CountryCity
    {
        if ($cityId) {
            return CountryCity::query()
                ->where('country_id', $country->id)
                ->find($cityId);
        }

        $displayName = $this->displayName($name);
        $normalizedName = $this->normalizedName($displayName);
        if ($displayName === '' || $normalizedName === '') {
            return null;
        }

        $city = CountryCity::query()
            ->where('country_id', $country->id)
            ->where('state_id', $state?->id)
            ->where('normalized_name', $normalizedName)
            ->first();

        if ($city) {
            return $city;
        }

        return CountryCity::create([
            'country_id' => $country->id,
            'state_id' => $state?->id,
            'name' => $displayName,
            'normalized_name' => $normalizedName,
        ]);
    }

    private function displayName(?string $value): string
    {
        return Str::of($value ?: '')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }

    public function normalizedName(?string $value): string
    {
        $normalized = Str::of($value ?: '')
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', ' ')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        return Str::of($normalized)
            ->replaceMatches('/\s+(region|mkoa|province|state|county|district|wilaya|city|municipality|municipal|town)$/', '')
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();
    }
}
