<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->decimal('reference_lat', 10, 8)->nullable()->after('max_distance_km');
            $table->decimal('reference_lng', 11, 8)->nullable()->after('reference_lat');
            $table->string('reference_name')->nullable()->after('reference_lng'); // e.g. 'Kariakoo'
        });
    }

    public function down(): void
    {
        Schema::table('shipping_zones', function (Blueprint $table) {
            $table->dropColumn(['reference_lat', 'reference_lng', 'reference_name']);
        });
    }
};
