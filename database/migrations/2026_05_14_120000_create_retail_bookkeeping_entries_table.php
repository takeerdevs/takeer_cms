<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retail_bookkeeping_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('merchant_staffs')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('entry_type', ['income', 'expense', 'director_loan', 'tax_payment']);
            $table->string('category');
            $table->string('counterparty')->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('currency_code', 8)->default('TZS');
            $table->enum('payment_method', ['cash', 'bank', 'mobile_money', 'card', 'takeer_wallet', 'director_loan', 'other']);
            $table->enum('reference_type', ['efd_receipt', 'bank_transaction', 'mobile_money', 'invoice', 'tra_payment', 'contract', 'other'])->nullable();
            $table->string('reference_number')->nullable();
            $table->string('tax_type')->nullable();
            $table->string('tax_period')->nullable();
            $table->date('transaction_date');
            $table->text('description')->nullable();
            $table->string('attachment_disk')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->string('attachment_mime')->nullable();
            $table->unsignedBigInteger('attachment_size')->nullable();
            $table->enum('status', ['active', 'voided'])->default('active');
            $table->foreignId('voided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'transaction_date']);
            $table->index(['merchant_id', 'entry_type']);
            $table->index(['merchant_id', 'status']);
            $table->index(['merchant_id', 'reference_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_entries');
    }
};
