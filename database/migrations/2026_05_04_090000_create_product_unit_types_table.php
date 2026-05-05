<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_unit_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('code', 40)->unique();
            $table->string('symbol', 24)->nullable();
            $table->string('unit_category', 40)->index();
            $table->string('base_unit_code', 40)->nullable();
            $table->decimal('conversion_factor_to_base', 18, 6)->default(1);
            $table->boolean('allows_decimal')->default(false);
            $table->json('localized_labels')->nullable();
            $table->json('common_quantities')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['unit_category', 'is_active', 'sort_order']);
        });

        Schema::create('product_category_unit_type', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('product_categories')->cascadeOnDelete();
            $table->foreignId('unit_type_id')->constrained('product_unit_types')->cascadeOnDelete();
            $table->boolean('is_default')->default(false);
            $table->decimal('min_order_quantity', 18, 6)->nullable();
            $table->decimal('order_increment', 18, 6)->nullable();
            $table->timestamps();

            $table->unique(['category_id', 'unit_type_id']);
            $table->index(['category_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_category_unit_type');
        Schema::dropIfExists('product_unit_types');
    }
};
