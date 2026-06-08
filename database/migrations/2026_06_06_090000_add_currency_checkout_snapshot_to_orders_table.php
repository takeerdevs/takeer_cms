<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('merchant_currency_code', 3)->nullable()->after('total_paid');
            $table->string('customer_currency_code', 3)->nullable()->after('merchant_currency_code');
            $table->string('fx_base_currency_code', 3)->nullable()->after('customer_currency_code');
            $table->decimal('fx_rate_merchant_to_base', 20, 10)->nullable()->after('fx_base_currency_code');
            $table->decimal('fx_rate_customer_to_base', 20, 10)->nullable()->after('fx_rate_merchant_to_base');
            $table->decimal('fx_rate_merchant_to_customer', 20, 10)->nullable()->after('fx_rate_customer_to_base');
            $table->date('fx_rate_date')->nullable()->after('fx_rate_merchant_to_customer');
            $table->decimal('merchant_unit_price', 14, 2)->nullable()->after('fx_rate_date');
            $table->decimal('customer_unit_price', 14, 2)->nullable()->after('merchant_unit_price');
            $table->decimal('merchant_total_amount', 14, 2)->nullable()->after('customer_unit_price');
            $table->decimal('customer_total_amount', 14, 2)->nullable()->after('merchant_total_amount');
            $table->decimal('merchant_shipping_fee', 14, 2)->nullable()->after('customer_total_amount');
            $table->decimal('customer_shipping_fee', 14, 2)->nullable()->after('merchant_shipping_fee');
            $table->decimal('merchant_discount_amount', 14, 2)->nullable()->after('customer_shipping_fee');
            $table->decimal('customer_discount_amount', 14, 2)->nullable()->after('merchant_discount_amount');

            $table->index(['merchant_currency_code', 'created_at']);
            $table->index(['customer_currency_code', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['merchant_currency_code', 'created_at']);
            $table->dropIndex(['customer_currency_code', 'created_at']);
            $table->dropColumn([
                'merchant_currency_code',
                'customer_currency_code',
                'fx_base_currency_code',
                'fx_rate_merchant_to_base',
                'fx_rate_customer_to_base',
                'fx_rate_merchant_to_customer',
                'fx_rate_date',
                'merchant_unit_price',
                'customer_unit_price',
                'merchant_total_amount',
                'customer_total_amount',
                'merchant_shipping_fee',
                'customer_shipping_fee',
                'merchant_discount_amount',
                'customer_discount_amount',
            ]);
        });
    }
};
