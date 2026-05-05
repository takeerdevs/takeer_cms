<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('link_previews', function (Blueprint $table) {
            $table->id();
            $table->string('url_hash', 64)->unique();
            $table->string('url', 2048);
            $table->string('final_url', 2048)->nullable();
            $table->string('title', 500)->nullable();
            $table->text('description')->nullable();
            $table->string('site_name', 255)->nullable();
            $table->string('favicon_url', 2048)->nullable();
            $table->string('remote_image_url', 2048)->nullable();
            $table->string('image_url', 2048)->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamp('fetched_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'expires_at']);
            $table->index('url');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('link_previews');
    }
};
