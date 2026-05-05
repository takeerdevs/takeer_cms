<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('product_unit_type_id')->nullable()->after('shipping_profile_id')->constrained('product_unit_types')->nullOnDelete();
            $table->decimal('sellable_quantity', 12, 3)->default(1)->after('product_unit_type_id');
            $table->decimal('min_order_quantity', 12, 3)->nullable()->after('sellable_quantity');
            $table->decimal('order_increment', 12, 3)->nullable()->after('min_order_quantity');
            $table->decimal('inventory_quantity', 14, 3)->nullable()->after('inventory_count');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->decimal('inventory_quantity', 14, 3)->nullable()->after('inventory_count');
        });

        Schema::table('product_location_inventories', function (Blueprint $table) {
            $table->decimal('quantity_decimal', 14, 3)->nullable()->after('quantity');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('requested_quantity', 12, 3)->default(1)->after('quantity');
            $table->foreignId('product_unit_type_id')->nullable()->after('requested_quantity')->constrained('product_unit_types')->nullOnDelete();
            $table->json('unit_snapshot')->nullable()->after('product_unit_type_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_unit_type_id');
            $table->dropColumn(['requested_quantity', 'unit_snapshot']);
        });

        Schema::table('product_location_inventories', function (Blueprint $table) {
            $table->dropColumn('quantity_decimal');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('inventory_quantity');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_unit_type_id');
            $table->dropColumn(['sellable_quantity', 'min_order_quantity', 'order_increment', 'inventory_quantity']);
        });
    }
};
