<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();

            $table->decimal('price', 12, 2);
            $table->foreignId('currency_id')->nullable()->constrained('currencies')->nullOnDelete();

            $table->enum('billing_interval', ['hourly', 'daily', 'weekly', 'monthly'])->default('monthly');
            $table->unsignedSmallInteger('interval_count')->default(1);
            $table->json('weekly_days')->nullable()->comment('For weekly schedules, e.g. ["monday", "friday"]');
            $table->unsignedTinyInteger('monthly_day')->nullable();

            $table->unsignedTinyInteger('trial_days')->nullable();
            $table->unsignedSmallInteger('tier')->default(1);
            $table->enum('status', ['draft', 'active', 'archived'])->default('draft');
            $table->timestamps();

            $table->index('merchant_id');
            $table->index('status');
            $table->index('billing_interval');
        });

        Schema::create('subscription_plan_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subscription_plan_id')->constrained('subscription_plans')->cascadeOnDelete();
            $table->string('item_type')->comment('product|content_item|bundle');
            $table->unsignedBigInteger('item_id');
            $table->unsignedInteger('unlock_after_days')->default(0);
            $table->timestamps();

            $table->index(['item_type', 'item_id']);
            $table->unique(['subscription_plan_id', 'item_type', 'item_id'], 'subscription_plan_items_unique_item');
        });

        Schema::create('user_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('subscription_plan_id')->constrained('subscription_plans')->restrictOnDelete();

            $table->enum('status', ['pending', 'active', 'past_due', 'cancelled', 'expired', 'paused'])->default('pending');
            $table->boolean('auto_renew')->default(true);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('current_period_start')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('next_billing_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('merchant_id');
            $table->index('subscription_plan_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_subscriptions');
        Schema::dropIfExists('subscription_plan_items');
        Schema::dropIfExists('subscription_plans');
    }
};
