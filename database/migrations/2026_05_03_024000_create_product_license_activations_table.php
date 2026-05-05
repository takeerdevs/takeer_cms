<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_license_activations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_license_key_id')->constrained('product_license_keys')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('device_hash', 64);
            $table->string('device_id', 160)->nullable();
            $table->string('site_url', 2048)->nullable();
            $table->string('app_version', 80)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->string('status', 30)->default('active');
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['product_license_key_id', 'device_hash'], 'license_device_unique');
            $table->index(['product_id', 'status']);
            $table->index(['merchant_id', 'last_seen_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_license_activations');
    }
};
