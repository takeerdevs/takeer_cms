<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('service_mode')->default('pay_now')->after('service_is_showcase');
            $table->string('service_price_display')->default('fixed')->after('service_mode');
            $table->unsignedInteger('service_duration_minutes')->nullable()->after('service_price_display');
            $table->string('service_location_type')->nullable()->after('service_duration_minutes');
            $table->json('service_area')->nullable()->after('service_location_type');
            $table->text('service_client_requirements')->nullable()->after('service_area');
            $table->string('service_booking_provider')->default('manual')->after('service_client_requirements');
            $table->string('service_contact_channel')->nullable()->after('service_booking_provider');
            $table->string('service_contact_value')->nullable()->after('service_contact_channel');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'service_mode',
                'service_price_display',
                'service_duration_minutes',
                'service_location_type',
                'service_area',
                'service_client_requirements',
                'service_booking_provider',
                'service_contact_channel',
                'service_contact_value',
            ]);
        });
    }
};
