<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            if (!Schema::hasColumn('shipping_zones', 'coverage_scope')) {
                $table->string('coverage_scope')->default('city_region')->after('delivery_type');
            }
        });

        DB::table('shipping_zones')
            ->where('delivery_type', 'local_boda')
            ->update(['coverage_scope' => 'distance_band']);

        DB::table('shipping_zones')
            ->where('delivery_type', 'self_pickup')
            ->update(['coverage_scope' => 'pickup']);
    }

    public function down(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->dropColumn('coverage_scope');
        });
    }
};
