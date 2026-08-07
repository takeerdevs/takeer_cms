<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_commerce_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('public_id', 32)->unique();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->string('platform', 32);
            $table->string('original_url', 2048);
            $table->string('normalized_url', 2048);
            $table->char('url_hash', 64);
            $table->string('external_post_id', 255)->nullable();
            $table->string('external_seller_handle', 255)->nullable();
            $table->string('external_seller_name', 255)->nullable();
            $table->string('external_seller_profile_url', 2048)->nullable();
            $table->foreignId('link_preview_id')->nullable()->constrained('link_previews')->nullOnDelete();
            $table->string('preview_status', 32)->default('pending');
            $table->string('preview_provenance', 64)->nullable();
            $table->json('preview_snapshot')->nullable();
            $table->string('buyer_screenshot_path', 2048)->nullable();
            $table->text('buyer_product_note')->nullable();
            $table->text('buyer_variant_note')->nullable();
            $table->decimal('requested_quantity', 12, 3)->default(1);
            $table->decimal('observed_unit_price', 12, 2)->nullable();
            $table->string('observed_currency_code', 12)->nullable();
            $table->foreignId('destination_country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignId('destination_state_id')->nullable()->constrained('country_states')->nullOnDelete();
            $table->foreignId('destination_city_id')->nullable()->constrained('country_cities')->nullOnDelete();
            $table->string('destination_summary', 255)->nullable();
            $table->text('delivery_context_encrypted')->nullable();
            $table->string('preferred_delivery_type', 40)->nullable();
            $table->text('seller_phone_encrypted')->nullable();
            $table->char('seller_phone_hash', 64)->nullable();
            $table->string('seller_phone_source', 40)->nullable();
            $table->timestamp('seller_contact_attested_at')->nullable();
            $table->string('status', 32)->default('awaiting_seller');
            $table->foreignId('claimed_merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->json('offer_snapshot')->nullable();
            $table->timestamp('offer_expires_at')->nullable();
            $table->foreignId('order_id')->nullable()->unique()->constrained('orders')->nullOnDelete();
            $table->string('idempotency_key', 120)->unique();
            $table->timestamp('claim_started_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('offer_ready_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->timestamp('declined_at')->nullable();
            $table->timestamp('expires_at');
            $table->string('closed_reason', 120)->nullable();
            $table->unsignedInteger('lock_version')->default(0);
            $table->timestamps();

            $table->index(['buyer_id', 'status']);
            $table->index(['url_hash', 'buyer_id', 'status']);
            $table->index(['status', 'expires_at']);
            $table->index(['claimed_merchant_id', 'status']);
        });

        Schema::create('social_commerce_request_invitations', function (Blueprint $table): void {
            $table->id();
            $table->string('public_id', 32)->unique();
            $table->foreignId('social_commerce_request_id')->constrained('social_commerce_requests')->cascadeOnDelete();
            $table->string('channel', 40);
            $table->text('recipient_encrypted')->nullable();
            $table->char('recipient_hash', 64)->nullable();
            $table->char('token_hash', 64)->unique();
            $table->string('status', 24)->default('created');
            $table->string('provider_reference', 255)->nullable();
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->string('dedupe_key', 180)->unique();
            $table->json('message_snapshot');
            $table->json('metadata')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['social_commerce_request_id', 'status']);
            $table->index(['recipient_hash', 'created_at']);
        });

        Schema::create('social_commerce_request_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('social_commerce_request_id')->constrained('social_commerce_requests')->cascadeOnDelete();
            $table->string('actor_type', 40)->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('event_type', 80);
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32)->nullable();
            $table->string('channel', 40)->nullable();
            $table->char('ip_hash', 64)->nullable();
            $table->string('user_agent_summary', 255)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamp('created_at')->nullable();

            $table->index(['social_commerce_request_id', 'occurred_at']);
            $table->index(['event_type', 'occurred_at']);
        });

        Schema::create('social_product_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('merchant_social_account_id')->nullable()->constrained('merchant_social_accounts')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('platform', 32);
            $table->string('provider_post_id', 255);
            $table->string('normalized_url', 2048);
            $table->char('url_hash', 64);
            $table->string('status', 24)->default('active');
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['platform', 'merchant_social_account_id', 'provider_post_id'], 'social_product_links_provider_unique');
            $table->unique(['platform', 'url_hash'], 'social_product_links_url_unique');
            $table->index(['merchant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_product_links');
        Schema::dropIfExists('social_commerce_request_events');
        Schema::dropIfExists('social_commerce_request_invitations');
        Schema::dropIfExists('social_commerce_requests');
    }
};
