<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('fee_policies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('category', ['sale', 'withdrawal', 'subscription', 'storage']);
            $table->enum('scope', ['global', 'country', 'currency', 'merchant', 'payment_channel'])->default('global');
            $table->string('country_code', 2)->nullable();
            $table->string('currency_code', 3)->nullable();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->enum('fee_type', ['percentage', 'fixed', 'hybrid'])->default('percentage');
            $table->decimal('percentage_rate', 8, 4)->default(0);
            $table->decimal('fixed_amount', 14, 2)->default(0);
            $table->string('fixed_fee_currency_code', 3)->default('USD');
            $table->decimal('min_fee', 14, 2)->nullable();
            $table->decimal('max_fee', 14, 2)->nullable();
            $table->decimal('unit_size_gb', 10, 2)->nullable();
            $table->enum('billing_interval', ['one_time', 'monthly', 'yearly'])->nullable();
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['category', 'scope', 'is_active']);
            $table->index(['currency_code', 'country_code']);
            $table->index(['effective_from', 'effective_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fee_policies');
    }
};
