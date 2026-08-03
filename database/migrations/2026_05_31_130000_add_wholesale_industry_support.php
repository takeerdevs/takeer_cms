<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('selling_style', 20)->default('retail')->after('type');
            $table->decimal('supply_capacity_quantity', 14, 3)->nullable()->after('order_increment');
            $table->string('supply_capacity_period', 40)->nullable()->after('supply_capacity_quantity');
            $table->string('wholesale_deposit_mode', 40)->default('quote_based')->after('supply_capacity_period');
            $table->decimal('wholesale_deposit_percent', 5, 2)->nullable()->after('wholesale_deposit_mode');
            $table->string('wholesale_balance_due', 60)->default('before_delivery')->after('wholesale_deposit_percent');
            $table->boolean('provider_mobile_money_enabled')->default(true)->after('wholesale_balance_due');
            $table->boolean('provider_bank_transfer_enabled')->default(true)->after('provider_mobile_money_enabled');
            $table->boolean('provider_card_enabled')->default(false)->after('provider_bank_transfer_enabled');

            $table->index(['type', 'selling_style']);
            $table->index(['selling_style', 'min_order_quantity']);
        });

        Schema::create('product_pricing_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->decimal('min_quantity', 14, 3);
            $table->decimal('max_quantity', 14, 3)->nullable();
            $table->decimal('unit_price', 14, 2);
            $table->string('currency', 3)->default('TZS');
            $table->string('label', 120)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort_order']);
            $table->index(['merchant_id', 'min_quantity', 'unit_price']);
        });

        Schema::create('product_lead_time_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->decimal('min_quantity', 14, 3);
            $table->decimal('max_quantity', 14, 3)->nullable();
            $table->unsignedInteger('lead_time_days')->nullable();
            $table->string('label', 160)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort_order']);
        });

        Schema::create('product_packaging_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('selling_units', 120)->nullable();
            $table->decimal('package_quantity', 14, 3)->nullable();
            $table->string('package_unit', 60)->nullable();
            $table->decimal('package_weight_kg', 12, 3)->nullable();
            $table->decimal('package_length_cm', 12, 2)->nullable();
            $table->decimal('package_width_cm', 12, 2)->nullable();
            $table->decimal('package_height_cm', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort_order']);
        });

        Schema::create('product_customization_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->decimal('min_order_quantity', 14, 3)->nullable();
            $table->string('fee_type', 30)->default('quote');
            $table->decimal('fee_amount', 14, 2)->nullable();
            $table->string('currency', 3)->default('TZS');
            $table->string('image_url', 2048)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort_order']);
            $table->index(['merchant_id', 'name']);
        });

        Schema::create('product_specifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('group_name', 120)->nullable();
            $table->string('attribute_name', 160);
            $table->text('attribute_value');
            $table->boolean('is_filterable')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'sort_order']);
            $table->index(['merchant_id', 'attribute_name']);
            $table->index(['is_filterable', 'attribute_name']);
        });

        Schema::create('product_detail_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('section_type', 40)->default('text');
            $table->string('title', 160)->nullable();
            $table->text('body')->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->boolean('is_visible')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'is_visible', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_detail_sections');
        Schema::dropIfExists('product_specifications');
        Schema::dropIfExists('product_customization_options');
        Schema::dropIfExists('product_packaging_details');
        Schema::dropIfExists('product_lead_time_tiers');
        Schema::dropIfExists('product_pricing_tiers');

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['type', 'selling_style']);
            $table->dropIndex(['selling_style', 'min_order_quantity']);
            $table->dropColumn([
                'selling_style',
                'supply_capacity_quantity',
                'supply_capacity_period',
                'wholesale_deposit_mode',
                'wholesale_deposit_percent',
                'wholesale_balance_due',
                'provider_mobile_money_enabled',
                'provider_bank_transfer_enabled',
                'provider_card_enabled',
            ]);
        });
    }
};
