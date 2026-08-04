<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('try_on_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('access_token_hash', 64)->unique();
            $table->string('portrait_disk', 50)->default('local');
            $table->string('portrait_path', 2048);
            $table->string('portrait_mime', 120)->nullable();
            $table->unsignedBigInteger('portrait_size')->nullable();
            $table->string('result_disk', 50)->nullable();
            $table->string('result_path', 2048)->nullable();
            $table->string('result_mime', 120)->nullable();
            $table->string('status', 30)->default('pending');
            $table->string('provider', 80)->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['product_id', 'status']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('try_on_sessions');
    }
};
