<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_seller_payment_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->cascadeOnDelete();
            $table->string('provider_merchant_id');
            $table->string('provider_submerchant_id')->nullable();
            $table->string('onboarding_status')->default('pending');
            $table->string('kyc_status')->default('pending');
            $table->string('beneficiary_status')->default('pending_provider_verification');
            $table->boolean('payouts_enabled')->default(false);
            $table->boolean('collections_enabled')->default(false);
            $table->char('provider_country_code', 2)->default('TZ');
            $table->json('provider_currency_codes')->nullable();
            $table->string('provider_status_reference')->nullable();
            $table->timestamp('onboarded_at')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('restrictions')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'provider_merchant_id']);
            $table->index(['merchant_id', 'payouts_enabled', 'beneficiary_status']);
        });

        Schema::create('payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->restrictOnDelete();
            $table->foreignId('payment_provider_channel_id')->nullable()->constrained('payment_provider_channels')->nullOnDelete();
            $table->string('provider_merchant_id')->nullable();
            $table->string('takeer_reference')->unique();
            $table->unsignedBigInteger('expected_amount_minor');
            $table->char('expected_currency', 3);
            $table->char('expected_country_code', 2);
            $table->text('payment_phone_encrypted')->nullable();
            $table->char('payment_phone_hash', 64)->nullable()->index();
            $table->string('state')->default('created')->index();
            $table->string('idempotency_key')->unique();
            $table->string('provider_request_reference')->nullable();
            $table->string('provider_transaction_reference')->nullable();
            $table->json('request_snapshot');
            $table->json('response_snapshot')->nullable();
            $table->timestamp('initiated_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'provider_transaction_reference'], 'payment_attempts_provider_reference_unique');
            $table->index(['order_id', 'state']);
        });

        Schema::create('provider_events', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->restrictOnDelete();
            $table->string('direction')->index();
            $table->string('event_type')->index();
            $table->string('provider_event_id')->nullable();
            $table->string('provider_transaction_reference')->nullable();
            $table->string('takeer_reference')->nullable()->index();
            $table->timestamp('received_at');
            $table->string('source_ip')->nullable();
            $table->text('raw_body_encrypted');
            $table->char('raw_body_sha256', 64);
            $table->json('filtered_headers')->nullable();
            $table->boolean('signature_present')->default(false);
            $table->boolean('signature_valid')->default(false);
            $table->string('replay_key')->unique();
            $table->unsignedBigInteger('amount_minor')->nullable();
            $table->char('currency', 3)->nullable();
            $table->string('validation_state')->default('received')->index();
            $table->json('validation_errors')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->string('processing_result')->nullable();
            $table->string('related_type')->nullable();
            $table->unsignedBigInteger('related_id')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'provider_event_id'], 'provider_events_provider_id_unique');
            $table->index(['provider_transaction_reference', 'direction']);
        });

        Schema::create('order_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained('orders')->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->restrictOnDelete();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->restrictOnDelete();
            $table->foreignId('payment_attempt_id')->constrained('payment_attempts')->restrictOnDelete();
            $table->char('currency', 3);
            $table->unsignedBigInteger('buyer_paid_amount_minor');
            $table->unsignedBigInteger('seller_amount_minor');
            $table->unsignedBigInteger('takeer_fee_amount_minor')->default(0);
            $table->unsignedBigInteger('provider_fee_amount_minor')->nullable();
            $table->unsignedBigInteger('tax_amount_minor')->nullable();
            $table->unsignedBigInteger('refunded_amount_minor')->default(0);
            $table->unsignedBigInteger('payout_eligible_amount_minor')->default(0);
            $table->unsignedBigInteger('paid_out_amount_minor')->default(0);
            $table->string('settlement_state')->default('awaiting_payment')->index();
            $table->string('hold_reason')->nullable();
            $table->json('release_rule_snapshot');
            $table->timestamp('release_eligible_at')->nullable();
            $table->timestamp('release_requested_at')->nullable();
            $table->timestamp('refund_requested_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'settlement_state']);
        });

        Schema::create('settlement_transitions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_settlement_id')->constrained('order_settlements')->cascadeOnDelete();
            $table->string('from_state')->nullable();
            $table->string('to_state');
            $table->string('reason_code');
            $table->string('actor_type')->nullable();
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->json('evidence')->nullable();
            $table->timestamp('created_at');

            $table->index(['order_settlement_id', 'created_at']);
        });

        Schema::create('provider_payouts', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('merchant_id')->constrained('merchants')->restrictOnDelete();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->restrictOnDelete();
            $table->foreignId('seller_payment_profile_id')->constrained('marketplace_seller_payment_profiles')->restrictOnDelete();
            $table->char('currency', 3);
            $table->unsignedBigInteger('amount_minor');
            $table->string('state')->default('created')->index();
            $table->string('provider_payout_reference')->nullable();
            $table->string('provider_idempotency_key')->unique();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('failure_code')->nullable();
            $table->text('failure_message')->nullable();
            $table->unsignedInteger('retry_count')->default(0);
            $table->timestamp('next_retry_at')->nullable();
            $table->foreignId('last_provider_event_id')->nullable()->constrained('provider_events')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'state']);
            $table->index('provider_payout_reference');
        });

        Schema::create('provider_payout_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_payout_id')->constrained('provider_payouts')->cascadeOnDelete();
            $table->foreignId('order_settlement_id')->constrained('order_settlements')->restrictOnDelete();
            $table->unsignedBigInteger('amount_minor');
            $table->timestamps();

            $table->unique(['provider_payout_id', 'order_settlement_id']);
            $table->unique('order_settlement_id');
        });

        Schema::create('provider_refunds', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('order_settlement_id')->constrained('order_settlements')->restrictOnDelete();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->restrictOnDelete();
            $table->string('provider_transaction_reference');
            $table->unsignedBigInteger('amount_minor');
            $table->char('currency', 3);
            $table->string('reason_code');
            $table->string('state')->default('requested')->index();
            $table->string('requested_by_type');
            $table->unsignedBigInteger('requested_by_id')->nullable();
            $table->string('provider_refund_reference')->nullable();
            $table->string('provider_idempotency_key')->unique();
            $table->timestamp('requested_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->foreignId('last_provider_event_id')->nullable()->constrained('provider_events')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['order_settlement_id', 'state']);
            $table->index('provider_refund_reference');
        });

        Schema::create('provider_reconciliation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->restrictOnDelete();
            $table->date('business_date');
            $table->string('source_type');
            $table->string('source_reference')->nullable();
            $table->char('source_hash', 64)->nullable();
            $table->unsignedInteger('expected_count')->default(0);
            $table->unsignedInteger('actual_count')->default(0);
            $table->bigInteger('expected_amount_minor')->default(0);
            $table->bigInteger('actual_amount_minor')->default(0);
            $table->char('currency', 3);
            $table->bigInteger('difference_amount_minor')->default(0);
            $table->string('status')->default('started')->index();
            $table->timestamp('started_at');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'business_date', 'source_type']);
        });

        Schema::create('provider_reconciliation_breaks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reconciliation_run_id')->constrained('provider_reconciliation_runs')->cascadeOnDelete();
            $table->string('break_type')->index();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('payment_attempt_id')->nullable()->constrained('payment_attempts')->nullOnDelete();
            $table->foreignId('provider_payout_id')->nullable()->constrained('provider_payouts')->nullOnDelete();
            $table->string('provider_reference')->nullable();
            $table->bigInteger('amount_minor')->default(0);
            $table->char('currency', 3);
            $table->string('severity')->default('medium');
            $table->string('status')->default('open')->index();
            $table->string('owner')->nullable();
            $table->timestamp('first_seen_at');
            $table->text('resolution')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_reconciliation_breaks');
        Schema::dropIfExists('provider_reconciliation_runs');
        Schema::dropIfExists('provider_refunds');
        Schema::dropIfExists('provider_payout_allocations');
        Schema::dropIfExists('provider_payouts');
        Schema::dropIfExists('settlement_transitions');
        Schema::dropIfExists('order_settlements');
        Schema::dropIfExists('provider_events');
        Schema::dropIfExists('payment_attempts');
        Schema::dropIfExists('marketplace_seller_payment_profiles');
    }
};
