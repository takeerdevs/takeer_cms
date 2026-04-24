<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            if (!Schema::hasColumn('deliveries', 'shipping_hotspot_id')) {
                $table->foreignId('shipping_hotspot_id')->nullable()->after('shipping_zone_id')->constrained('shipping_hotspots')->nullOnDelete();
            }
            if (!Schema::hasColumn('deliveries', 'latitude')) {
                $table->decimal('latitude', 10, 8)->nullable()->after('physical_address');
            }
            if (!Schema::hasColumn('deliveries', 'longitude')) {
                $table->decimal('longitude', 11, 8)->nullable()->after('latitude');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropForeign(['shipping_hotspot_id']);
            $table->dropColumn(['shipping_hotspot_id', 'latitude', 'longitude']);
        });
    }
};
