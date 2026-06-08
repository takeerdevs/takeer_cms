<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_providers', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->string('driver')->nullable();
            $table->string('status')->default('enabled')->index();
            $table->string('logo_url')->nullable();
            $table->json('config_schema')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_provider_countries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->cascadeOnDelete();
            $table->string('country_code', 2)->index();
            $table->boolean('enabled')->default(true)->index();
            $table->json('supported_directions')->nullable();
            $table->json('supported_currencies')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'country_code']);
        });

        Schema::create('payment_provider_channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->cascadeOnDelete();
            $table->string('key')->unique();
            $table->string('country_code', 2)->index();
            $table->string('direction')->index();
            $table->string('method')->index();
            $table->string('network')->nullable()->index();
            $table->string('name');
            $table->string('logo_url')->nullable();
            $table->json('currencies')->nullable();
            $table->string('status')->default('enabled')->index();
            $table->unsignedInteger('priority')->default(100)->index();
            $table->json('required_fields_schema')->nullable();
            $table->json('supported_networks')->nullable();
            $table->json('supported_banks')->nullable();
            $table->json('limits')->nullable();
            $table->string('fee_type')->default('fixed_plus_percent');
            $table->decimal('fee_fixed', 14, 2)->default(0);
            $table->unsignedInteger('fee_percent_bps')->default(0);
            $table->decimal('fee_min', 14, 2)->default(0);
            $table->decimal('fee_max', 14, 2)->nullable();
            $table->unsignedInteger('fx_margin_bps')->default(0);
            $table->string('settlement_note')->nullable();
            $table->json('provider_metadata')->nullable();
            $table->timestamps();

            $table->index(['country_code', 'direction', 'method', 'status']);
        });

        Schema::create('merchant_payout_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('payment_provider_channel_id')->constrained('payment_provider_channels')->restrictOnDelete();
            $table->string('label');
            $table->string('method')->index();
            $table->string('network')->nullable()->index();
            $table->string('currency_code', 3)->index();
            $table->text('details_encrypted')->nullable();
            $table->json('details_masked')->nullable();
            $table->string('verification_status')->default('unverified')->index();
            $table->timestamp('verified_at')->nullable();
            $table->boolean('is_default')->default(false)->index();
            $table->string('status')->default('active')->index();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
        });

        Schema::create('payment_channel_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_provider_channel_id')->constrained('payment_provider_channels')->cascadeOnDelete();
            $table->string('severity')->default('minor')->index();
            $table->string('status')->default('investigating')->index();
            $table->string('title');
            $table->text('message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->json('notified_merchant_ids')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->foreignId('payment_provider_id')->nullable()->after('method')->constrained('payment_providers')->nullOnDelete();
            $table->foreignId('payment_provider_channel_id')->nullable()->after('payment_provider_id')->constrained('payment_provider_channels')->nullOnDelete();
            $table->foreignId('merchant_payout_credential_id')->nullable()->after('payment_provider_channel_id')->constrained('merchant_payout_credentials')->nullOnDelete();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('payment_provider_id')->nullable()->after('payment_gateway')->constrained('payment_providers')->nullOnDelete();
            $table->foreignId('payment_provider_channel_id')->nullable()->after('payment_provider_id')->constrained('payment_provider_channels')->nullOnDelete();
            $table->json('payment_channel_snapshot')->nullable()->after('payment_provider_channel_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('payment_provider_channel_id');
            $table->dropConstrainedForeignId('payment_provider_id');
            $table->dropColumn('payment_channel_snapshot');
        });

        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('merchant_payout_credential_id');
            $table->dropConstrainedForeignId('payment_provider_channel_id');
            $table->dropConstrainedForeignId('payment_provider_id');
        });

        Schema::dropIfExists('payment_channel_incidents');
        Schema::dropIfExists('merchant_payout_credentials');
        Schema::dropIfExists('payment_provider_channels');
        Schema::dropIfExists('payment_provider_countries');
        Schema::dropIfExists('payment_providers');
    }
};
