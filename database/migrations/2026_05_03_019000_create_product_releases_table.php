<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_releases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('version', 80);
            $table->string('title')->nullable();
            $table->text('changelog')->nullable();
            $table->string('file_url', 2048);
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->string('status', 30)->default('published');
            $table->boolean('is_latest')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'version']);
            $table->index(['product_id', 'status', 'is_latest']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_releases');
    }
};
