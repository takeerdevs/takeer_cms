<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_coupons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('code', 64);
            $table->string('name')->nullable();
            $table->text('description')->nullable();
            $table->string('discount_type', 20)->default('percent');
            $table->decimal('discount_value', 12, 2);
            $table->decimal('minimum_order_amount', 12, 2)->nullable();
            $table->decimal('maximum_discount_amount', 12, 2)->nullable();
            $table->string('applies_to_type', 40)->default('all');
            $table->unsignedBigInteger('applies_to_id')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('usage_limit_per_customer')->nullable();
            $table->unsignedInteger('times_used')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('status', 20)->default('active');
            $table->timestamps();

            $table->unique(['merchant_id', 'code']);
            $table->index(['merchant_id', 'status']);
            $table->index(['applies_to_type', 'applies_to_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('merchant_coupon_id')->nullable()->after('discount_amount')->constrained('merchant_coupons')->nullOnDelete();
            $table->string('coupon_code', 64)->nullable()->after('merchant_coupon_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('merchant_coupon_id');
            $table->dropColumn('coupon_code');
        });

        Schema::dropIfExists('merchant_coupons');
    }
};
