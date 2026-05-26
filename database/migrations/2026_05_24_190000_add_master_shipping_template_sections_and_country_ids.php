<?php

use App\Models\Country;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipping_profiles', function (Blueprint $table) {
            if (!Schema::hasColumn('shipping_profiles', 'in_city_enabled')) {
                $table->boolean('in_city_enabled')->default(true)->after('outside_area_policy');
            }
            if (!Schema::hasColumn('shipping_profiles', 'intercity_enabled')) {
                $table->boolean('intercity_enabled')->default(true)->after('in_city_enabled');
            }
            if (!Schema::hasColumn('shipping_profiles', 'international_enabled')) {
                $table->boolean('international_enabled')->default(false)->after('intercity_enabled');
            }
        });

        Schema::table('shipping_zones', function (Blueprint $table) {
            if (!Schema::hasColumn('shipping_zones', 'destination_country_id')) {
                $table->foreignId('destination_country_id')
                    ->nullable()
                    ->after('destination_country')
                    ->constrained('countries')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('shipping_zones', 'destination_state_id')) {
                $table->foreignId('destination_state_id')
                    ->nullable()
                    ->after('destination_country_id')
                    ->constrained('country_states')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('shipping_zones', 'destination_city_id')) {
                $table->foreignId('destination_city_id')
                    ->nullable()
                    ->after('destination_state_id')
                    ->constrained('country_cities')
                    ->nullOnDelete();
            }
        });

        Schema::table('user_addresses', function (Blueprint $table) {
            if (!Schema::hasColumn('user_addresses', 'country_id')) {
                $table->foreignId('country_id')
                    ->nullable()
                    ->after('extra_details')
                    ->constrained('countries')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('user_addresses', 'state_id')) {
                $table->foreignId('state_id')
                    ->nullable()
                    ->after('country_id')
                    ->constrained('country_states')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('user_addresses', 'city_id')) {
                $table->foreignId('city_id')
                    ->nullable()
                    ->after('state_id')
                    ->constrained('country_cities')
                    ->nullOnDelete();
            }
        });

        Schema::table('merchant_locations', function (Blueprint $table) {
            if (!Schema::hasColumn('merchant_locations', 'country_id')) {
                $table->foreignId('country_id')
                    ->nullable()
                    ->after('place_id')
                    ->constrained('countries')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('merchant_locations', 'state_id')) {
                $table->foreignId('state_id')
                    ->nullable()
                    ->after('country_id')
                    ->constrained('country_states')
                    ->nullOnDelete();
            }
            if (!Schema::hasColumn('merchant_locations', 'city_id')) {
                $table->foreignId('city_id')
                    ->nullable()
                    ->after('state_id')
                    ->constrained('country_cities')
                    ->nullOnDelete();
            }
        });

        $countries = Country::query()
            ->select(['id', 'name', 'iso_alpha2'])
            ->get()
            ->flatMap(fn (Country $country) => [
                strtolower((string) $country->name) => $country->id,
                strtolower((string) $country->iso_alpha2) => $country->id,
            ]);

        DB::table('shipping_zones')
            ->whereNull('destination_country_id')
            ->whereNotNull('destination_country')
            ->get(['id', 'destination_country'])
            ->each(function ($zone) use ($countries) {
                $countryId = $countries[strtolower(trim((string) $zone->destination_country))] ?? null;
                if ($countryId) {
                    DB::table('shipping_zones')->where('id', $zone->id)->update(['destination_country_id' => $countryId]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('user_addresses', function (Blueprint $table) {
            if (Schema::hasColumn('user_addresses', 'city_id')) {
                $table->dropConstrainedForeignId('city_id');
            }
            if (Schema::hasColumn('user_addresses', 'state_id')) {
                $table->dropConstrainedForeignId('state_id');
            }
            if (Schema::hasColumn('user_addresses', 'country_id')) {
                $table->dropConstrainedForeignId('country_id');
            }
        });

        Schema::table('shipping_zones', function (Blueprint $table) {
            if (Schema::hasColumn('shipping_zones', 'destination_city_id')) {
                $table->dropConstrainedForeignId('destination_city_id');
            }
            if (Schema::hasColumn('shipping_zones', 'destination_state_id')) {
                $table->dropConstrainedForeignId('destination_state_id');
            }
            if (Schema::hasColumn('shipping_zones', 'destination_country_id')) {
                $table->dropConstrainedForeignId('destination_country_id');
            }
        });

        Schema::table('merchant_locations', function (Blueprint $table) {
            if (Schema::hasColumn('merchant_locations', 'city_id')) {
                $table->dropConstrainedForeignId('city_id');
            }
            if (Schema::hasColumn('merchant_locations', 'state_id')) {
                $table->dropConstrainedForeignId('state_id');
            }
            if (Schema::hasColumn('merchant_locations', 'country_id')) {
                $table->dropConstrainedForeignId('country_id');
            }
        });

        Schema::table('shipping_profiles', function (Blueprint $table) {
            foreach (['in_city_enabled', 'intercity_enabled', 'international_enabled'] as $column) {
                if (Schema::hasColumn('shipping_profiles', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
