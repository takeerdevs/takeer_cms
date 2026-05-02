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
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('source', ['online', 'pos'])->default('online')->after('public_id');
            $table->enum('payment_mode', ['online_escrow', 'cash', 'merchant_mm', 'store_credit'])->default('online_escrow')->after('payment_status');
            $table->foreignId('pos_staff_id')->nullable()->constrained('merchant_staffs')->onDelete('set null')->after('merchant_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['source', 'payment_mode', 'pos_staff_id']);
        });
    }
};
