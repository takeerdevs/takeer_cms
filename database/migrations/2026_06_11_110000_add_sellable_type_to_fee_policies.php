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
            DB::statement("ALTER TABLE fee_policies ADD CONSTRAINT fee_policies_scope_check CHECK (scope in ('global', 'country', 'currency', 'merchant', 'payment_channel', 'sellable_type'))");
        }

        Schema::table('fee_policies', function (Blueprint $table) {
            $table->string('sellable_type', 40)->nullable()->after('payment_channel');
            $table->index(['category', 'sellable_type', 'is_active']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->string('fee_sellable_type', 40)->nullable()->after('fee_payment_channel');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('fee_sellable_type');
        });

        Schema::table('fee_policies', function (Blueprint $table) {
            $table->dropIndex(['category', 'sellable_type', 'is_active']);
            $table->dropColumn('sellable_type');
        });

        if (DB::connection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE fee_policies DROP CONSTRAINT IF EXISTS fee_policies_scope_check');
            DB::statement("ALTER TABLE fee_policies ADD CONSTRAINT fee_policies_scope_check CHECK (scope in ('global', 'country', 'currency', 'merchant', 'payment_channel'))");
        }
    }
};
