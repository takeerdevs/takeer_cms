<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_locationables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('merchant_location_id')->constrained('merchant_locations')->cascadeOnDelete();
            $table->morphs('locationable');
            $table->string('availability_type')->default('serves');
            $table->boolean('is_enabled')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(
                ['merchant_location_id', 'locationable_type', 'locationable_id', 'availability_type'],
                'merchant_locationable_unique'
            );
            $table->index(['merchant_id', 'availability_type', 'is_enabled'], 'merchant_locationable_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_locationables');
    }
};
