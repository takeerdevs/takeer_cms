<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_category_brand_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('product_categories')->cascadeOnDelete();
            $table->foreignId('brand_id')->constrained('product_brands')->cascadeOnDelete();
            $table->foreignId('model_id')->constrained('product_brand_models')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['category_id', 'brand_id', 'model_id'], 'pcb_models_unique');
            $table->index(['category_id', 'brand_id'], 'pcb_models_category_brand_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_category_brand_models');
    }
};

