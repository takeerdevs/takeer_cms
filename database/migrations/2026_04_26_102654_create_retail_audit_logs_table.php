<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('retail_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')->constrained()->onDelete('cascade');
            $table->foreignId('staff_id')->nullable()->constrained('merchant_staffs')->onDelete('set null');
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
            $table->string('action'); // e.g., 'STOCK_ADJUST', 'SALE_VOIDED', 'TRANSFER_DISPATCHED'
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('retail_audit_logs');
    }
};
