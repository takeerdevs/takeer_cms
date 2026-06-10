<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('holding_fee_payment_order_id')
                ->nullable()
                ->after('holding_fee_amount')
                ->constrained('orders')
                ->nullOnDelete();
            $table->timestamp('holding_fee_paid_at')->nullable()->after('holding_fee_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('holding_fee_payment_order_id');
            $table->dropColumn('holding_fee_paid_at');
        });
    }
};
