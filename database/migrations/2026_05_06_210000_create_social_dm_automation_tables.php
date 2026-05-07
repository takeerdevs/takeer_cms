<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_social_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('platform', 30)->default('instagram');
            $table->string('provider_account_id', 120);
            $table->string('username')->nullable();
            $table->string('display_name')->nullable();
            $table->string('account_type', 60)->nullable();
            $table->string('access_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->string('status', 30)->default('connected');
            $table->timestamp('last_webhook_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['platform', 'provider_account_id']);
            $table->index(['merchant_id', 'platform', 'status']);
        });

        Schema::create('merchant_social_dm_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('social_account_id')->nullable()->constrained('merchant_social_accounts')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('platform', 30)->default('instagram');
            $table->string('post_provider_id')->nullable();
            $table->string('post_url')->nullable();
            $table->json('trigger_keywords');
            $table->string('match_mode', 30)->default('contains');
            $table->string('destination_type', 40)->default('storefront');
            $table->unsignedBigInteger('destination_id')->nullable();
            $table->string('destination_url')->nullable();
            $table->text('dm_message');
            $table->text('public_reply_message')->nullable();
            $table->string('status', 30)->default('draft');
            $table->unsignedInteger('comments_count')->default(0);
            $table->unsignedInteger('matched_count')->default(0);
            $table->unsignedInteger('dm_sent_count')->default(0);
            $table->unsignedInteger('dm_failed_count')->default(0);
            $table->unsignedInteger('clicks_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('last_triggered_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['platform', 'post_provider_id']);
        });

        Schema::create('merchant_social_dm_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained('merchant_social_dm_campaigns')->nullOnDelete();
            $table->foreignId('social_account_id')->nullable()->constrained('merchant_social_accounts')->nullOnDelete();
            $table->string('platform', 30)->default('instagram');
            $table->string('provider_comment_id', 160);
            $table->string('provider_post_id', 160)->nullable();
            $table->string('commenter_provider_id', 160)->nullable();
            $table->string('commenter_username')->nullable();
            $table->text('comment_text')->nullable();
            $table->string('matched_keyword')->nullable();
            $table->string('status', 40)->default('received');
            $table->text('dm_message')->nullable();
            $table->string('destination_url')->nullable();
            $table->string('provider_message_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->unique(['platform', 'provider_comment_id']);
            $table->index(['merchant_id', 'status']);
            $table->index(['campaign_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_social_dm_events');
        Schema::dropIfExists('merchant_social_dm_campaigns');
        Schema::dropIfExists('merchant_social_accounts');
    }
};
