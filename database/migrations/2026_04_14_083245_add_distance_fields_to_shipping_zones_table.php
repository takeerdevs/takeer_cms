<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->foreignId('merchant_location_id')->nullable()->after('merchant_id')->constrained('merchant_locations')->nullOnDelete();
            $table->decimal('max_distance_km', 10, 2)->nullable()->after('flat_rate_fee');
            $table->string('destination_region')->nullable()->after('max_distance_km');
        });
    }

    public function down(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->dropForeign(['merchant_location_id']);
            $table->dropColumn(['merchant_location_id', 'max_distance_km', 'destination_region']);
        });
    }
};
