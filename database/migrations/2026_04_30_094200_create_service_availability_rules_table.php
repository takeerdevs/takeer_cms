<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_availability_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->cascadeOnDelete();
            $table->string('timezone')->default('Africa/Dar_es_Salaam');
            $table->unsignedTinyInteger('weekday');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedInteger('slot_interval_minutes')->default(30);
            $table->unsignedInteger('buffer_minutes')->default(0);
            $table->unsignedInteger('capacity')->default(1);
            $table->boolean('is_active')->default(true);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'product_id', 'weekday', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_availability_rules');
    }
};
