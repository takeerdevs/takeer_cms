<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_whatsapp_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('phone_number_id', 120)->unique();
            $table->string('business_account_id', 120)->nullable();
            $table->string('display_phone_number', 60)->nullable();
            $table->string('verified_name')->nullable();
            $table->string('access_token')->nullable();
            $table->string('status', 30)->default('connected');
            $table->timestamp('last_webhook_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
        });

        Schema::create('merchant_whatsapp_automations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('whatsapp_account_id')->nullable()->constrained('merchant_whatsapp_accounts')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->json('trigger_keywords');
            $table->string('match_mode', 30)->default('contains');
            $table->string('destination_type', 40)->default('storefront');
            $table->unsignedBigInteger('destination_id')->nullable();
            $table->string('destination_url')->nullable();
            $table->text('response_message');
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('received_count')->default(0);
            $table->unsignedInteger('matched_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('clicks_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('last_triggered_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
        });

        Schema::create('merchant_whatsapp_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('automation_id')->nullable()->constrained('merchant_whatsapp_automations')->nullOnDelete();
            $table->foreignId('whatsapp_account_id')->nullable()->constrained('merchant_whatsapp_accounts')->nullOnDelete();
            $table->string('provider_message_id', 180)->unique();
            $table->string('from_phone', 60)->nullable();
            $table->string('profile_name')->nullable();
            $table->text('message_text')->nullable();
            $table->string('matched_keyword')->nullable();
            $table->string('status', 40)->default('received');
            $table->text('response_message')->nullable();
            $table->string('destination_url')->nullable();
            $table->string('provider_response_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['automation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_whatsapp_events');
        Schema::dropIfExists('merchant_whatsapp_automations');
        Schema::dropIfExists('merchant_whatsapp_accounts');
    }
};
