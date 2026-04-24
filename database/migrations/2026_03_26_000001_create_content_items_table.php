<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('content_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('excerpt', 500)->nullable();
            $table->longText('body');
            $table->enum('format', ['plain_text', 'markdown', 'html', 'editorjs'])->default('editorjs');

            $table->enum('visibility', ['draft', 'published', 'archived'])->default('draft');
            $table->decimal('price', 12, 2)->nullable();
            $table->foreignId('currency_id')->nullable()->constrained('currencies')->nullOnDelete();

            $table->enum('moderation_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('moderation_notes')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('merchant_id');
            $table->index('visibility');
            $table->index('moderation_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_items');
    }
};
