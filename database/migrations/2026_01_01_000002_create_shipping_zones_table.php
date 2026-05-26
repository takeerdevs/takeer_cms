<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('shipping_zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('zone_name');
            $table->decimal('flat_rate_fee', 10, 2)->comment('Flat delivery rate');
            $table->enum('delivery_type', ['local_boda', 'intercity_bus', 'self_pickup']);
            $table->string('coverage_scope')->default('city_region');
            $table->foreignId('destination_country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignId('destination_state_id')->nullable()->constrained('country_states')->nullOnDelete();
            $table->foreignId('destination_city_id')->nullable()->constrained('country_cities')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('merchant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_zones');
    }
};
