<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            $table->foreignId('merchant_id')->nullable()->after('user_id')->constrained('merchants')->nullOnDelete();
            $table->unique('merchant_id');
            $table->index(['user_id', 'merchant_id']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('merchant_id')->nullable()->after('user_id')->constrained('merchants')->nullOnDelete();
            $table->index(['merchant_id', 'type']);
        });

        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->foreignId('merchant_id')->nullable()->after('user_id')->constrained('merchants')->nullOnDelete();
            $table->string('method')->nullable()->after('merchant_id');
            $table->index(['merchant_id', 'status']);
        });

        DB::statement(
            'UPDATE transactions
             SET merchant_id = (SELECT merchant_id FROM orders WHERE orders.id = transactions.order_id)
             WHERE merchant_id IS NULL AND order_id IS NOT NULL'
        );
    }

    public function down(): void
    {
        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->dropIndex(['merchant_id', 'status']);
            $table->dropColumn('method');
            $table->dropConstrainedForeignId('merchant_id');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['merchant_id', 'type']);
            $table->dropConstrainedForeignId('merchant_id');
        });

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'merchant_id']);
            $table->dropUnique(['merchant_id']);
            $table->dropConstrainedForeignId('merchant_id');
        });
    }
};
