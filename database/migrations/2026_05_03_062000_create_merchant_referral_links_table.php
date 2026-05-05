<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_referral_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('code', 80)->unique();
            $table->string('label')->nullable();
            $table->enum('target_type', ['storefront', 'product', 'bundle', 'subscription_plan', 'post', 'content_item'])->default('storefront');
            $table->unsignedBigInteger('target_id')->nullable();
            $table->enum('reward_type', ['none', 'percent', 'fixed'])->default('none');
            $table->decimal('reward_value', 12, 2)->default(0);
            $table->unsignedInteger('clicks_count')->default(0);
            $table->unsignedInteger('conversions_count')->default(0);
            $table->decimal('revenue_amount', 12, 2)->default(0);
            $table->timestamp('last_clicked_at')->nullable();
            $table->timestamp('last_converted_at')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->enum('status', ['active', 'paused', 'expired'])->default('active');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['target_type', 'target_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('merchant_referral_link_id')->nullable()->after('coupon_code')->constrained('merchant_referral_links')->nullOnDelete();
            $table->string('referral_code', 80)->nullable()->after('merchant_referral_link_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('merchant_referral_link_id');
            $table->dropColumn('referral_code');
        });

        Schema::dropIfExists('merchant_referral_links');
    }
};
