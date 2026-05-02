<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_strikes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dispute_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type')->default('pos_payment_link_abuse');
            $table->string('severity')->default('warning');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'type']);
            $table->index(['merchant_id', 'severity']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_strikes');
    }
};
