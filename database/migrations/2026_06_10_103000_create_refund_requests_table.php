<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('buyer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source')->default('admin');
            $table->string('status')->default('pending');
            $table->decimal('amount', 14, 2);
            $table->string('currency_code', 3)->default('TZS');
            $table->decimal('merchant_penalty_amount', 14, 2)->default(0);
            $table->decimal('merchant_penalty_percent', 5, 2)->default(0);
            $table->text('reason')->nullable();
            $table->json('snapshot')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'source']);
            $table->index(['merchant_id', 'status']);
            $table->unique(['order_id', 'source']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_requests');
    }
};
