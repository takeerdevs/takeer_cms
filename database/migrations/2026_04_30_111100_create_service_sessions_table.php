<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->string('timezone')->default('Africa/Dar_es_Salaam');
            $table->string('location_type')->nullable();
            $table->string('location_text')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->decimal('price_override', 12, 2)->nullable();
            $table->timestamp('registration_deadline')->nullable();
            $table->string('status')->default('open');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'product_id', 'starts_at']);
            $table->index(['product_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_sessions');
    }
};
