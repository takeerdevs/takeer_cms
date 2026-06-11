<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('extra_charges', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('buyer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('proposed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('accepted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('removed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('context')->default('order_chat');
            $table->string('charge_type')->default('agreement');
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('currency_code', 3)->default('TZS');
            $table->string('status')->default('proposed');
            $table->timestamp('proposed_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('removed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'status']);
            $table->index(['payment_order_id', 'status']);
            $table->index(['merchant_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('extra_charges');
    }
};
