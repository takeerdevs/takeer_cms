<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('buyer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->string('purchasable_type')->nullable()->comment('product|bundle|content_item|subscription_plan');
            $table->unsignedBigInteger('purchasable_id')->nullable();
            $table->enum('order_kind', ['one_time', 'subscription_initial', 'subscription_renewal'])->default('one_time');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->decimal('total_paid', 12, 2)->comment('Total in TZS including delivery fee');
            $table->enum('payment_status', [
                'pending',                      // Awaiting M-Pesa USSD push
                'paid_pending_confirmation',     // Payment received; awaiting merchant 30-min confirmation window
                'awaiting_merchant_confirmation',// Merchant must confirm stock or refund
                'escrow_locked',                // Merchant confirmed dispatch; escrow held
                'disputed',                     // Buyer raised dispute with unboxing video
                'resolved_merchant_paid',       // Admin/auto-released: merchant receives funds
                'resolved_buyer_refunded',      // Admin/auto-released: buyer refunded
                'failed',                       // Payment failed or expired
            ])->default('pending');
            $table->string('merchant_dispatch_video_url')->nullable();
            $table->string('transaction_ref')->nullable()->unique();
            $table->string('idempotency_key')->nullable()->unique()->comment('Prevents double-charge on checkout');
            $table->timestamps();

            $table->index('buyer_id');
            $table->index('merchant_id');
            $table->index('product_id');
            $table->index(['purchasable_type', 'purchasable_id']);
            $table->index('payment_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
