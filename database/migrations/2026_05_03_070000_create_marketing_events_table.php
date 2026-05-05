<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketing_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('session_id', 80)->index();
            $table->string('event_type', 80)->index();
            $table->string('entity_type', 80)->nullable()->index();
            $table->unsignedBigInteger('entity_id')->nullable()->index();
            $table->string('source', 80)->nullable()->index();
            $table->string('source_url', 1000)->nullable();
            $table->string('landing_url', 1000)->nullable();
            $table->string('referrer_url', 1000)->nullable();
            $table->string('utm_source', 120)->nullable();
            $table->string('utm_medium', 120)->nullable();
            $table->string('utm_campaign', 160)->nullable();
            $table->string('utm_content', 160)->nullable();
            $table->string('utm_term', 160)->nullable();
            $table->foreignId('merchant_referral_link_id')->nullable()->constrained('merchant_referral_links')->nullOnDelete();
            $table->string('referral_code', 80)->nullable();
            $table->string('coupon_code', 64)->nullable();
            $table->decimal('value', 12, 2)->nullable();
            $table->string('ip_address', 64)->nullable();
            $table->string('user_agent', 1000)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'event_type', 'created_at']);
            $table->index(['session_id', 'created_at']);
            $table->index(['entity_type', 'entity_id', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('marketing_events');
    }
};
