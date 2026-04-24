<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('withdrawal_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->decimal('amount', 14, 2)->comment('Requested withdrawal amount in TZS');
            $table->enum('status', ['pending', 'completed', 'failed'])->default('pending');
            $table->string('mpesa_transaction_id')->nullable()->comment('B2C payout reference');
            $table->string('idempotency_key')->nullable()->unique()->comment('Double-spend guard');
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawal_requests');
    }
};
