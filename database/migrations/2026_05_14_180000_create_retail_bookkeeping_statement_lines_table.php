<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retail_bookkeeping_statement_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('matched_entry_id')->nullable()->constrained('retail_bookkeeping_entries')->nullOnDelete();
            $table->enum('source_type', ['bank', 'mobile_money', 'card', 'other'])->default('bank');
            $table->string('source_name')->nullable();
            $table->date('transaction_date');
            $table->string('reference_number')->nullable();
            $table->string('counterparty')->nullable();
            $table->text('description')->nullable();
            $table->enum('line_type', ['credit', 'debit'])->default('debit');
            $table->decimal('amount', 14, 2);
            $table->string('currency_code', 8)->default('TZS');
            $table->enum('status', ['unmatched', 'matched', 'ignored'])->default('unmatched');
            $table->timestamp('matched_at')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'status']);
            $table->index(['merchant_id', 'transaction_date']);
            $table->index(['merchant_id', 'reference_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_statement_lines');
    }
};
