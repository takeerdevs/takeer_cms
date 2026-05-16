<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retail_business_obligations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('obligation_type')->default('custom')->index();
            $table->string('authority')->nullable();
            $table->date('due_date')->index();
            $table->unsignedSmallInteger('remind_days_before')->default(14);
            $table->boolean('sms_reminder_enabled')->default(true);
            $table->string('status')->default('open')->index();
            $table->dateTime('completed_at')->nullable();
            $table->string('reference_number')->nullable();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('retail_recurring_bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('vendor');
            $table->string('category')->default('Other Expense');
            $table->decimal('amount', 15, 2);
            $table->string('currency_code', 8)->default('TZS');
            $table->string('frequency')->default('monthly')->index();
            $table->date('next_due_date')->index();
            $table->unsignedSmallInteger('remind_days_before')->default(7);
            $table->boolean('sms_reminder_enabled')->default(true);
            $table->string('payment_method')->default('bank');
            $table->string('reference_type')->nullable();
            $table->string('status')->default('active')->index();
            $table->date('last_paid_at')->nullable();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('retail_payroll_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('worker_name');
            $table->string('worker_type')->default('employee')->index();
            $table->string('role')->nullable();
            $table->decimal('gross_amount', 15, 2);
            $table->decimal('deductions_amount', 15, 2)->default(0);
            $table->decimal('net_amount', 15, 2);
            $table->string('currency_code', 8)->default('TZS');
            $table->string('pay_period');
            $table->date('pay_date')->index();
            $table->string('payment_method')->default('bank');
            $table->string('reference_number')->nullable();
            $table->string('tax_type')->nullable();
            $table->string('status')->default('pending')->index();
            $table->foreignId('bookkeeping_entry_id')->nullable()->constrained('retail_bookkeeping_entries')->nullOnDelete();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('retail_bookkeeping_share_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('token', 80)->unique();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_role')->default('accountant');
            $table->date('from_date')->nullable();
            $table->date('to_date')->nullable();
            $table->json('sections')->nullable();
            $table->dateTime('expires_at')->nullable()->index();
            $table->dateTime('last_accessed_at')->nullable();
            $table->unsignedInteger('access_count')->default(0);
            $table->string('status')->default('active')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retail_bookkeeping_share_links');
        Schema::dropIfExists('retail_payroll_records');
        Schema::dropIfExists('retail_recurring_bills');
        Schema::dropIfExists('retail_business_obligations');
    }
};
