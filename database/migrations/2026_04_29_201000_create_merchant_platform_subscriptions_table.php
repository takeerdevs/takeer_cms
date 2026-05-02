<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_platform_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->enum('feature', ['retail_ops', 'storage']);
            $table->enum('status', ['free', 'trialing', 'active', 'past_due', 'cancelled', 'expired'])->default('active');
            $table->string('currency_code', 3)->default('TZS');
            $table->decimal('amount', 14, 2)->default(0);
            $table->enum('billing_interval', ['one_time', 'monthly', 'yearly'])->default('monthly');
            $table->unsignedInteger('storage_mb')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('next_billing_at')->nullable();
            $table->timestamp('last_paid_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'feature', 'status']);
            $table->index(['current_period_end', 'next_billing_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_platform_subscriptions');
    }
};
