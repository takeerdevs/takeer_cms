<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('name')->default('Main Shop');
            $table->text('address')->nullable();
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->string('place_id')->nullable();
            $table->string('city')->nullable();
            $table->string('region')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->index(['latitude', 'longitude']);
            $table->index('merchant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_locations');
    }
};
