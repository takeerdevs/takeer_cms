<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('admin_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });

        // Seed default settings
        DB::table('admin_settings')->insertOrIgnore([
            ['key' => 'ai_provider', 'value' => 'openrouter', 'description' => 'Active AI provider: openrouter or gemini', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'openrouter_api_key', 'value' => '', 'description' => 'OpenRouter API key for vision & chat AI', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'openrouter_default_model', 'value' => 'google/gemini-2.5-flash', 'description' => 'Default model for product analysis', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'gemini_api_key', 'value' => '', 'description' => 'Direct Google Gemini API key', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'gemini_default_model', 'value' => 'gemini-1.5-flash', 'description' => 'Default Gemini model', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_settings');
    }
};
