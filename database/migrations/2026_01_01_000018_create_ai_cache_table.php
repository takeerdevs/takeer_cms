<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ai_cache', function (Blueprint $table) {
            $table->id();
            $table->string('query_hash', 64)->unique()->comment('SHA-256 of normalized user query');
            $table->json('response_json')->comment('Cached LLM/Vision API response');
            $table->string('model_used')->nullable()->comment('e.g. gemini-1.5-flash, gemini-1.5-pro');
            $table->unsignedInteger('hit_count')->default(0)->comment('Number of times this cache entry was served');
            $table->timestamp('expires_at')->nullable()->comment('Cache TTL — null = permanent');
            $table->timestamps();

            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_cache');
    }
};
