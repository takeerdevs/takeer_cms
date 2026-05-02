<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 32)->unique();
            $table->foreignId('merchant_id')->constrained('merchants')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('buyer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('request_type')->default('contact_request');
            $table->string('status')->default('pending');
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->date('preferred_date')->nullable();
            $table->string('preferred_time', 32)->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->string('location_text')->nullable();
            $table->text('message')->nullable();
            $table->json('client_requirements')->nullable();
            $table->decimal('quoted_amount', 12, 2)->nullable();
            $table->decimal('deposit_amount', 12, 2)->nullable();
            $table->string('booking_provider')->default('manual');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['product_id', 'status']);
            $table->index(['buyer_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_requests');
    }
};
