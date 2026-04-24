<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('subscription_invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_subscription_id')->constrained('user_subscriptions')->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->enum('status', ['pending', 'paid', 'failed', 'cancelled'])->default('pending');
            $table->timestamp('billed_for_start')->nullable();
            $table->timestamp('billed_for_end')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('reference')->nullable()->unique();
            $table->timestamps();

            $table->index('user_subscription_id');
            $table->index('order_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_invoices');
    }
};
