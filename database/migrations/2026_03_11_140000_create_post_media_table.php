<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('post_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('posts')->cascadeOnDelete();
            $table->string('media_url')->nullable(); // Nullable if linked to product media
            $table->enum('media_type', ['image', 'video', 'pdf'])->default('image');
            
            // Linking to product media
            $table->foreignId('product_image_id')->nullable()->constrained('product_images')->nullOnDelete();
            
            $table->unsignedBigInteger('likes_count')->default(0);
            $table->timestamps();

            $table->index('post_id');
            $table->index('product_image_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('post_media');
    }
};
