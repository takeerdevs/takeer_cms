<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retail_bookkeeping_account_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('merchant_staffs')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('item_type', ['receivable', 'payable']);
            $table->enum('status', ['open', 'paid', 'voided'])->default('open');
            $table->string('counterparty');
            $table->string('category')->nullable();
            $table->decimal('amount', 14, 2);
            $table->decimal('paid_amount', 14, 2)->default(0);
            $table->string('currency_code', 8)->default('TZS');
            $table->string('invoice_number')->nullable();
            $table->date('issue_date');
            $table->date('due_date')->nullable();
            $table->date('paid_at')->nullable();
            $table->foreignId('settlement_entry_id')->nullable()->constrained('retail_bookkeeping_entries')->nullOnDelete();
            $table->string('attachment_disk')->nullable();
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name')->nullable();
            $table->string('attachment_mime')->nullable();
            $table->unsignedBigInteger('attachment_size')->nullable();
            $table->text('description')->nullable();
            $table->text('void_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'item_type', 'status']);
            $table->index(['merchant_id', 'due_date']);
            $table->index(['merchant_id', 'invoice_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_account_items');
    }
};
