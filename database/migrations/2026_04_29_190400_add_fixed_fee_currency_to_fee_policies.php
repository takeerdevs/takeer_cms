<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('fee_policies', 'fixed_fee_currency_code')) {
            Schema::table('fee_policies', function (Blueprint $table) {
                $table->string('fixed_fee_currency_code', 3)->default('USD')->after('fixed_amount');
            });
        }

        if (! Schema::hasColumn('transactions', 'fee_fixed_currency_code')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->string('fee_fixed_currency_code', 3)->nullable()->after('fee_fixed_amount');
            });
        }

        if (! Schema::hasColumn('transactions', 'fee_fixed_amount_converted')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->decimal('fee_fixed_amount_converted', 14, 2)->nullable()->after('fee_fixed_currency_code');
            });
        }
    }

    public function down(): void
    {
        $transactionColumns = array_filter([
            Schema::hasColumn('transactions', 'fee_fixed_currency_code') ? 'fee_fixed_currency_code' : null,
            Schema::hasColumn('transactions', 'fee_fixed_amount_converted') ? 'fee_fixed_amount_converted' : null,
        ]);

        if ($transactionColumns !== []) {
            Schema::table('transactions', function (Blueprint $table) use ($transactionColumns) {
                $table->dropColumn($transactionColumns);
            });
        }

        if (Schema::hasColumn('fee_policies', 'fixed_fee_currency_code')) {
            Schema::table('fee_policies', function (Blueprint $table) {
                $table->dropColumn('fixed_fee_currency_code');
            });
        }
    }
};
