<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('one_click_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('payment_provider')->default('mpesa')->comment('e.g. mpesa, tigopesa');
            $table->string('payment_number')->comment('M-Pesa/mobile money number');
            $table->foreignId('delivery_zone_id')->nullable()->constrained('shipping_zones')->nullOnDelete();
            $table->string('delivery_landmark')->nullable()->comment('Human-readable landmark for boda delivery');
            $table->decimal('latitude', 10, 8)->nullable();
            $table->decimal('longitude', 11, 8)->nullable();
            $table->timestamps();

            $table->unique('user_id')->comment('One profile per user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('one_click_profiles');
    }
};
