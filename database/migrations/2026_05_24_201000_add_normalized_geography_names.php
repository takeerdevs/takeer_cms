<?php

use App\Support\GeographyResolver;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private bool $addedStateNormalizedName = false;
    private bool $addedCityNormalizedName = false;

    public function up(): void
    {
        Schema::table('country_states', function (Blueprint $table) {
            if (!Schema::hasColumn('country_states', 'normalized_name')) {
                $table->string('normalized_name')->nullable()->after('name');
                $this->addedStateNormalizedName = true;
            }
        });

        Schema::table('country_cities', function (Blueprint $table) {
            if (!Schema::hasColumn('country_cities', 'normalized_name')) {
                $table->string('normalized_name')->nullable()->after('name');
                $this->addedCityNormalizedName = true;
            }
        });

        $this->backfillNormalizedNames();
        $this->mergeDuplicateStates();
        $this->mergeDuplicateCities();

        Schema::table('country_states', function (Blueprint $table) {
            if ($this->addedStateNormalizedName) {
                $table->unique(['country_id', 'normalized_name'], 'country_states_country_normalized_unique');
            }
        });

        Schema::table('country_cities', function (Blueprint $table) {
            if ($this->addedCityNormalizedName) {
                $table->unique(['country_id', 'state_id', 'normalized_name'], 'country_cities_country_state_normalized_unique');
                $table->index(['country_id', 'normalized_name'], 'country_cities_country_normalized_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('country_cities', function (Blueprint $table) {
            if (Schema::hasColumn('country_cities', 'normalized_name')) {
                $table->dropColumn('normalized_name');
            }
        });

        Schema::table('country_states', function (Blueprint $table) {
            if (Schema::hasColumn('country_states', 'normalized_name')) {
                $table->dropColumn('normalized_name');
            }
        });
    }

    private function backfillNormalizedNames(): void
    {
        $resolver = app(GeographyResolver::class);

        DB::table('country_states')
            ->select(['id', 'name'])
            ->orderBy('id')
            ->each(function ($state) use ($resolver): void {
                DB::table('country_states')
                    ->where('id', $state->id)
                    ->update(['normalized_name' => $resolver->normalizedName($state->name)]);
            });

        DB::table('country_cities')
            ->select(['id', 'name'])
            ->orderBy('id')
            ->each(function ($city) use ($resolver): void {
                DB::table('country_cities')
                    ->where('id', $city->id)
                    ->update(['normalized_name' => $resolver->normalizedName($city->name)]);
            });
    }

    private function mergeDuplicateStates(): void
    {
        DB::table('country_states')
            ->select(['id', 'country_id', 'normalized_name'])
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($state) => $state->country_id . '|' . $state->normalized_name)
            ->each(function ($states): void {
                if ($states->count() < 2) {
                    return;
                }

                $keeperId = $states->first()->id;
                $duplicateIds = $states->slice(1)->pluck('id')->all();

                DB::table('merchant_locations')->whereIn('state_id', $duplicateIds)->update(['state_id' => $keeperId]);
                DB::table('user_addresses')->whereIn('state_id', $duplicateIds)->update(['state_id' => $keeperId]);
                DB::table('shipping_zones')->whereIn('destination_state_id', $duplicateIds)->update(['destination_state_id' => $keeperId]);
                DB::table('country_cities')->whereIn('state_id', $duplicateIds)->update(['state_id' => $keeperId]);
                DB::table('country_states')->whereIn('id', $duplicateIds)->delete();
            });
    }

    private function mergeDuplicateCities(): void
    {
        DB::table('country_cities')
            ->select(['id', 'country_id', 'state_id', 'normalized_name'])
            ->orderBy('id')
            ->get()
            ->groupBy(fn ($city) => $city->country_id . '|' . ($city->state_id ?: 'none') . '|' . $city->normalized_name)
            ->each(function ($cities): void {
                if ($cities->count() < 2) {
                    return;
                }

                $keeperId = $cities->first()->id;
                $duplicateIds = $cities->slice(1)->pluck('id')->all();

                DB::table('merchant_locations')->whereIn('city_id', $duplicateIds)->update(['city_id' => $keeperId]);
                DB::table('user_addresses')->whereIn('city_id', $duplicateIds)->update(['city_id' => $keeperId]);
                DB::table('shipping_zones')->whereIn('destination_city_id', $duplicateIds)->update(['destination_city_id' => $keeperId]);
                DB::table('country_cities')->whereIn('id', $duplicateIds)->delete();
            });
    }
};
