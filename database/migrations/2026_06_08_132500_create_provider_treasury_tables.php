<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('provider_treasury_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->cascadeOnDelete();
            $table->foreignId('payment_provider_channel_id')->nullable()->constrained('payment_provider_channels')->nullOnDelete();
            $table->string('provider_key')->index();
            $table->string('provider_channel_key')->nullable()->index();
            $table->string('country_code', 2)->nullable()->index();
            $table->string('method')->nullable()->index();
            $table->string('currency_code', 3)->index();
            $table->decimal('balance_amount', 18, 2)->default(0);
            $table->decimal('reserved_amount', 18, 2)->default(0);
            $table->decimal('minimum_available_amount', 18, 2)->default(0);
            $table->string('status')->default('active')->index();
            $table->string('balance_source')->default('manual')->index();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'payment_provider_channel_id', 'currency_code'], 'provider_treasury_account_unique');
        });

        Schema::create('provider_treasury_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_treasury_account_id')->constrained('provider_treasury_accounts')->cascadeOnDelete();
            $table->foreignId('withdrawal_request_id')->nullable()->constrained('withdrawal_requests')->nullOnDelete();
            $table->string('status')->default('reserved')->index();
            $table->decimal('amount', 18, 2);
            $table->decimal('payout_amount', 18, 2)->default(0);
            $table->decimal('provider_cost_amount', 18, 2)->default(0);
            $table->string('currency_code', 3)->index();
            $table->timestamp('reserved_at')->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['withdrawal_request_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_treasury_reservations');
        Schema::dropIfExists('provider_treasury_accounts');
    }
};
