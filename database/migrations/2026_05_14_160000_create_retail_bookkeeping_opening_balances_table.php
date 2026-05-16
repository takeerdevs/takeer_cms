<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retail_bookkeeping_opening_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->date('as_of_date');
            $table->decimal('cash_balance', 14, 2)->default(0);
            $table->decimal('bank_balance', 14, 2)->default(0);
            $table->decimal('mobile_money_balance', 14, 2)->default(0);
            $table->decimal('stock_value', 14, 2)->default(0);
            $table->decimal('director_loan_balance', 14, 2)->default(0);
            $table->decimal('accounts_receivable', 14, 2)->default(0);
            $table->decimal('accounts_payable', 14, 2)->default(0);
            $table->string('currency_code', 8)->default('TZS');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique('merchant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_opening_balances');
    }
};
