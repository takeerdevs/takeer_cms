<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('post_product_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained('posts')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->float('x_coordinate')->comment('Tap hotspot X position (0.0 – 1.0)');
            $table->float('y_coordinate')->comment('Tap hotspot Y position (0.0 – 1.0)');
            $table->timestamps();

            $table->index(['post_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_product_tags');
    }
};
