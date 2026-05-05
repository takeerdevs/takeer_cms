<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_abandoned_checkout_automations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_enabled')->default(false);
            $table->unsignedInteger('delay_minutes')->default(60);
            $table->unsignedInteger('max_age_days')->default(7);
            $table->string('coupon_code', 64)->nullable();
            $table->text('message');
            $table->timestamp('last_run_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('merchant_abandoned_checkout_recoveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('automation_id')->constrained('merchant_abandoned_checkout_automations')->cascadeOnDelete();
            $table->foreignId('marketing_event_id')->constrained('marketing_events')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('notification_log_id')->nullable()->constrained('notification_logs')->nullOnDelete();
            $table->string('phone');
            $table->string('status', 30)->default('sent');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['automation_id', 'marketing_event_id'], 'abandoned_recovery_unique_event');
            $table->index(['automation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_abandoned_checkout_recoveries');
        Schema::dropIfExists('merchant_abandoned_checkout_automations');
    }
};
