<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_category_attributes', function (Blueprint $table) {
            $table->boolean('is_filterable')->default(true)->after('is_required');
            $table->boolean('ai_extractable')->default(false)->after('is_filterable');
        });

        Schema::create('product_brands', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'name']);
        });

        Schema::create('product_brand_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained('product_brands')->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('slug', 140);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['brand_id', 'slug']);
            $table->index(['brand_id', 'is_active']);
        });

        Schema::create('product_category_brands', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('product_categories')->cascadeOnDelete();
            $table->foreignId('brand_id')->constrained('product_brands')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['category_id', 'brand_id']);
        });

        Schema::create('product_category_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('category_attribute_id')->constrained('product_category_attributes')->cascadeOnDelete();
            $table->text('value_text')->nullable();
            $table->decimal('value_number', 14, 4)->nullable();
            $table->boolean('value_boolean')->nullable();
            $table->json('value_json')->nullable();
            $table->string('source', 20)->default('merchant'); // merchant|ai|system
            $table->decimal('confidence', 4, 3)->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamps();

            $table->unique(['product_id', 'category_attribute_id']);
            $table->index(['category_attribute_id', 'source']);
        });

        Schema::table('product_attributes', function (Blueprint $table) {
            $table->foreignId('category_id')->nullable()->after('product_id')->constrained('product_categories')->nullOnDelete();
            $table->foreignId('sub_category_id')->nullable()->after('category_id')->constrained('product_categories')->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->after('sub_category_id')->constrained('product_brands')->nullOnDelete();
            $table->foreignId('model_id')->nullable()->after('brand_id')->constrained('product_brand_models')->nullOnDelete();
            $table->json('ai_extracted')->nullable()->after('suggested_description');
        });
    }

    public function down(): void
    {
        Schema::table('product_attributes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('model_id');
            $table->dropConstrainedForeignId('brand_id');
            $table->dropConstrainedForeignId('sub_category_id');
            $table->dropConstrainedForeignId('category_id');
            $table->dropColumn('ai_extracted');
        });

        Schema::dropIfExists('product_category_attribute_values');
        Schema::dropIfExists('product_category_brands');
        Schema::dropIfExists('product_brand_models');
        Schema::dropIfExists('product_brands');

        Schema::table('product_category_attributes', function (Blueprint $table) {
            $table->dropColumn(['is_filterable', 'ai_extractable']);
        });
    }
};
