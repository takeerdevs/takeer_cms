<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE fee_policies DROP CONSTRAINT IF EXISTS fee_policies_scope_check');
            DB::statement("ALTER TABLE fee_policies ADD CONSTRAINT fee_policies_scope_check CHECK (scope in ('global', 'country', 'currency', 'merchant', 'payment_channel'))");
        }

        Schema::table('fee_policies', function (Blueprint $table) {
            $table->string('payment_channel')->nullable()->after('merchant_id');
            $table->index(['category', 'payment_channel', 'is_active']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->string('fee_payment_channel')->nullable()->after('fee_fixed_amount');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('fee_payment_channel');
        });

        Schema::table('fee_policies', function (Blueprint $table) {
            $table->dropIndex(['category', 'payment_channel', 'is_active']);
            $table->dropColumn('payment_channel');
        });

        if (DB::connection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE fee_policies DROP CONSTRAINT IF EXISTS fee_policies_scope_check');
            DB::statement("ALTER TABLE fee_policies ADD CONSTRAINT fee_policies_scope_check CHECK (scope in ('global', 'country', 'currency', 'merchant'))");
        }
    }
};
