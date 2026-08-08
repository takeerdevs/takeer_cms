<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_item_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title');
            $table->string('excerpt', 500)->nullable();
            $table->longText('body');
            $table->string('format', 30)->default('lexical');
            $table->string('body_hash', 64);
            $table->timestamps();

            $table->unique(['content_item_id', 'version']);
            $table->index(['content_item_id', 'created_at']);
            $table->index(['content_item_id', 'body_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_item_versions');
    }
};
