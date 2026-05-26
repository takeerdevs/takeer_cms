<?php

use App\Support\GeographyResolver;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_locations', function (Blueprint $table) {
            if (!Schema::hasColumn('merchant_locations', 'country_id')) {
                $table->foreignId('country_id')->nullable()->after('place_id')->constrained('countries')->nullOnDelete();
            }
            if (!Schema::hasColumn('merchant_locations', 'state_id')) {
                $table->foreignId('state_id')->nullable()->after('country_id')->constrained('country_states')->nullOnDelete();
            }
            if (!Schema::hasColumn('merchant_locations', 'city_id')) {
                $table->foreignId('city_id')->nullable()->after('state_id')->constrained('country_cities')->nullOnDelete();
            }
        });

        Schema::table('user_addresses', function (Blueprint $table) {
            if (!Schema::hasColumn('user_addresses', 'state_id')) {
                $table->foreignId('state_id')->nullable()->after('country_id')->constrained('country_states')->nullOnDelete();
            }
            if (!Schema::hasColumn('user_addresses', 'city_id')) {
                $table->foreignId('city_id')->nullable()->after('state_id')->constrained('country_cities')->nullOnDelete();
            }
        });

        Schema::table('shipping_zones', function (Blueprint $table) {
            if (!Schema::hasColumn('shipping_zones', 'destination_state_id')) {
                $table->foreignId('destination_state_id')->nullable()->after('destination_country_id')->constrained('country_states')->nullOnDelete();
            }
            if (!Schema::hasColumn('shipping_zones', 'destination_city_id')) {
                $table->foreignId('destination_city_id')->nullable()->after('destination_state_id')->constrained('country_cities')->nullOnDelete();
            }
        });

        $this->backfillMerchantLocations();
        $this->backfillShippingZones();
    }

    public function down(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            if (Schema::hasColumn('shipping_zones', 'destination_city_id')) {
                $table->dropConstrainedForeignId('destination_city_id');
            }
            if (Schema::hasColumn('shipping_zones', 'destination_state_id')) {
                $table->dropConstrainedForeignId('destination_state_id');
            }
        });

        Schema::table('user_addresses', function (Blueprint $table) {
            if (Schema::hasColumn('user_addresses', 'city_id')) {
                $table->dropConstrainedForeignId('city_id');
            }
            if (Schema::hasColumn('user_addresses', 'state_id')) {
                $table->dropConstrainedForeignId('state_id');
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
    }

    private function backfillMerchantLocations(): void
    {
        if (!Schema::hasColumn('merchant_locations', 'country_id')) {
            return;
        }

        $resolver = app(GeographyResolver::class);

        DB::table('merchant_locations')
            ->join('merchants', 'merchants.id', '=', 'merchant_locations.merchant_id')
            ->whereNull('merchant_locations.country_id')
            ->whereNotNull('merchants.country_id')
            ->select([
                'merchant_locations.id',
                'merchant_locations.city',
                'merchant_locations.region',
                'merchants.country_id',
            ])
            ->orderBy('merchant_locations.id')
            ->each(function ($location) use ($resolver): void {
                $geo = $resolver->resolve(
                    countryId: (int) $location->country_id,
                    stateName: $location->region,
                    cityName: $location->city,
                );

                DB::table('merchant_locations')
                    ->where('id', $location->id)
                    ->update([
                        'country_id' => $geo['country_id'],
                        'state_id' => $geo['state_id'],
                        'city_id' => $geo['city_id'],
                    ]);
            });
    }

    private function backfillShippingZones(): void
    {
        $resolver = app(GeographyResolver::class);

        DB::table('shipping_zones')
            ->whereNull('destination_state_id')
            ->where(function ($query) {
                $query->whereNotNull('destination_country_id')
                    ->orWhereNotNull('destination_country');
            })
            ->select([
                'id',
                'destination_country_id',
                'destination_country',
                'destination_region',
                'destination_city',
            ])
            ->orderBy('id')
            ->each(function ($zone) use ($resolver): void {
                $geo = $resolver->resolve(
                    countryId: $zone->destination_country_id ? (int) $zone->destination_country_id : null,
                    countryName: $zone->destination_country,
                    stateName: $zone->destination_region,
                    cityName: $zone->destination_city,
                );

                DB::table('shipping_zones')
                    ->where('id', $zone->id)
                    ->update([
                        'destination_country_id' => $geo['country_id'] ?: $zone->destination_country_id,
                        'destination_state_id' => $geo['state_id'],
                        'destination_city_id' => $geo['city_id'],
                    ]);
            });
    }
};
