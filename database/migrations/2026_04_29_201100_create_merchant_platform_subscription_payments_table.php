<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_platform_subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_platform_subscription_id')
                ->nullable()
                ->constrained('merchant_platform_subscriptions')
                ->nullOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->enum('feature', ['retail_ops', 'storage']);
            $table->decimal('amount', 14, 2);
            $table->string('currency_code', 3)->default('TZS');
            $table->string('payment_method')->default('simulated');
            $table->enum('status', ['simulated_paid', 'paid', 'failed', 'refunded'])->default('simulated_paid');
            $table->string('provider_reference')->unique();
            $table->timestamp('paid_at')->nullable();
            $table->json('policy_snapshot')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'feature', 'status']);
            $table->index('paid_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_platform_subscription_payments');
    }
};
