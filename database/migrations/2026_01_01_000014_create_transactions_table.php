<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->enum('type', ['order_revenue', 'withdrawal', 'platform_fee']);
            $table->decimal('gross_amount', 14, 2)->comment('Total before deductions (TZS)');
            $table->decimal('net_amount', 14, 2)->comment('Amount after platform fee (TZS)');
            $table->decimal('tax_amount', 14, 2)->default(0)->comment('18% VAT on Takeer service fee (TZS)');
            $table->string('reference')->nullable()->unique()->comment('External payment reference or wallet TX ID');
            $table->timestamps();

            $table->index('user_id');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
