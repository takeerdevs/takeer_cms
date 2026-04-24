<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('item_type')->comment('product|content_item|bundle');
            $table->unsignedBigInteger('item_id');

            $table->string('source_type')->comment('order|bundle|subscription|admin_grant');
            $table->unsignedBigInteger('source_id')->nullable();

            $table->enum('status', ['active', 'expired', 'revoked'])->default('active');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
            $table->index('merchant_id');
            $table->index(['item_type', 'item_id']);
            $table->index(['source_type', 'source_id']);
            $table->index('status');
            $table->unique(['user_id', 'item_type', 'item_id', 'source_type', 'source_id'], 'entitlements_unique_grant');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entitlements');
    }
};
