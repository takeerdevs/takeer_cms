<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('service_pricing_model')->default('fixed_price')->after('download_link');
            $table->string('service_booking_type')->default('instant')->after('service_pricing_model');
            $table->decimal('service_hourly_rate', 12, 2)->nullable()->after('service_booking_type');
            $table->unsignedInteger('service_min_hours')->nullable()->after('service_hourly_rate');
            $table->decimal('service_deposit_amount', 12, 2)->nullable()->after('service_min_hours');
            $table->boolean('service_is_showcase')->default(false)->after('service_deposit_amount');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'service_pricing_model',
                'service_booking_type',
                'service_hourly_rate',
                'service_min_hours',
                'service_deposit_amount',
                'service_is_showcase',
            ]);
        });
    }
};

