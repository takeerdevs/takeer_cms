<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_sms_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('credits')->default(0);
            $table->unsignedInteger('lifetime_purchased')->default(0);
            $table->unsignedInteger('lifetime_used')->default(0);
            $table->timestamps();
        });

        Schema::create('merchant_sms_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('audience_type', 60)->default('all_customers');
            $table->unsignedBigInteger('audience_ref_id')->nullable();
            $table->text('message');
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('estimated_recipients')->default(0);
            $table->unsignedInteger('estimated_credits')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['audience_type', 'audience_ref_id']);
        });

        Schema::create('merchant_sms_campaign_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_sms_campaign_id')->constrained('merchant_sms_campaigns')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('phone');
            $table->string('status', 30)->default('pending');
            $table->foreignId('notification_log_id')->nullable()->constrained('notification_logs')->nullOnDelete();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['merchant_sms_campaign_id', 'phone'], 'sms_campaign_unique_phone');
            $table->index(['merchant_sms_campaign_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_sms_campaign_recipients');
        Schema::dropIfExists('merchant_sms_campaigns');
        Schema::dropIfExists('merchant_sms_balances');
    }
};
