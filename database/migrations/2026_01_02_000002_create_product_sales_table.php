<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('product_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('sale_price', 12, 2);
            $table->foreignId('currency_id')->constrained('currencies')->cascadeOnDelete();
            $table->unsignedInteger('quantity_sold')->default(1);
            $table->unsignedInteger('downloads')->default(0);
            
            // Fulfillment/Shipping fields
            $table->foreignId('shipping_zone_id')->nullable()->constrained('shipping_zones')->nullOnDelete();
            $table->string('merchant_packing_video')->nullable();
            $table->string('merchant_shipping_proof')->nullable();
            $table->string('customer_unboxing_video')->nullable();
            $table->timestamp('expected_receive_date')->nullable();
            
            $table->timestamps();

            $table->index('customer_id');
            $table->index('product_id');
            $table->index('currency_id');
            $table->index('shipping_zone_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_sales');
    }
};
