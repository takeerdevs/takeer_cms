<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug')->unique()->nullable();
            $table->enum('type', ['physical', 'digital', 'service'])->default('physical');
            
            $table->decimal('price', 12, 2);
            $table->decimal('compare_at_price', 12, 2)->nullable();
            $table->decimal('discounted_price', 12, 2)->nullable();
            $table->foreignId('currency_id')->nullable()->constrained('currencies')->nullOnDelete();
            
            $table->unsignedInteger('inventory_count')->default(0);
            $table->unsignedInteger('buffer_stock')->default(0)->comment('Hidden reserve');
            $table->string('url')->nullable()->comment('Primary external URL for service/physical or legacy digital references');
            $table->string('download_link')->nullable(); // For digital products
            
            $table->timestamps();

            $table->index('merchant_id');
            $table->index('currency_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
