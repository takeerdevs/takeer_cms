<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_attributes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('category')->nullable();
            $table->string('sub_category')->nullable();
            $table->json('colors')->nullable()->comment('Array of color strings detected by AI');
            $table->string('material')->nullable();
            $table->string('style')->nullable();
            $table->string('detected_gender')->nullable()->comment('e.g. male, female, unisex');
            $table->text('suggested_description')->nullable()->comment('AI-generated Swahili/English description');
            $table->timestamps();

            $table->unique('product_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_attributes');
    }
};
