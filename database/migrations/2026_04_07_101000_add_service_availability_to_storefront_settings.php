<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->json('service_hours')->nullable()->after('allow_post_reactions');
            $table->string('service_timezone', 64)->nullable()->after('service_hours');
            $table->enum('service_area_type', ['onsite', 'remote', 'hybrid'])->nullable()->after('service_timezone');
            $table->json('service_locations')->nullable()->after('service_area_type');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_storefront_settings', function (Blueprint $table) {
            $table->dropColumn([
                'service_hours',
                'service_timezone',
                'service_area_type',
                'service_locations',
            ]);
        });
    }
};
