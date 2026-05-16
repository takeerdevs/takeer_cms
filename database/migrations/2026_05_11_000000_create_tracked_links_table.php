<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracked_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('code', 80)->unique();
            $table->string('destination_hash', 64)->index();
            $table->string('destination_url', 2048);
            $table->string('destination_host', 255)->nullable()->index();
            $table->string('label')->nullable();
            $table->string('link_type', 80)->default('outbound')->index();
            $table->string('source_surface', 120)->nullable()->index();
            $table->string('entity_type', 80)->nullable()->index();
            $table->unsignedBigInteger('entity_id')->nullable()->index();
            $table->unsignedInteger('clicks_count')->default(0);
            $table->timestamp('last_clicked_at')->nullable();
            $table->enum('status', ['active', 'paused', 'disabled'])->default('active')->index();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['merchant_id', 'destination_hash', 'link_type', 'source_surface', 'entity_type', 'entity_id'], 'tracked_links_context_unique');
            $table->index(['merchant_id', 'link_type', 'created_at']);
            $table->index(['entity_type', 'entity_id', 'link_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_links');
    }
};
