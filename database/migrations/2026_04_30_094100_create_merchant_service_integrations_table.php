<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('merchant_service_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('provider');
            $table->string('status')->default('pending');
            $table->string('external_account_id')->nullable();
            $table->string('external_account_email')->nullable();
            $table->string('calendar_id')->nullable();
            $table->json('scopes')->nullable();
            $table->text('access_token')->nullable();
            $table->text('refresh_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->json('settings')->nullable();
            $table->timestamps();

            $table->unique(['merchant_id', 'provider']);
            $table->index(['provider', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_service_integrations');
    }
};
