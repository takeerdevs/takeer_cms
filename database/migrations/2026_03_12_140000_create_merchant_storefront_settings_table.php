<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_storefront_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_profile_id')->constrained('merchants')->cascadeOnDelete();
            $table->json('section_order')->nullable();
            $table->json('links')->nullable();
            $table->unsignedBigInteger('featured_product_id')->nullable();
            $table->timestamps();

            $table->unique('merchant_profile_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_storefront_settings');
    }
};
