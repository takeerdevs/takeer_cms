<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('fee_policy_id')->nullable()->after('type')->constrained('fee_policies')->nullOnDelete();
            $table->string('fee_policy_name')->nullable()->after('fee_policy_id');
            $table->enum('fee_policy_type', ['percentage', 'fixed', 'hybrid'])->nullable()->after('fee_policy_name');
            $table->decimal('fee_percentage_rate', 8, 4)->nullable()->after('fee_policy_type');
            $table->decimal('fee_fixed_amount', 14, 2)->nullable()->after('fee_percentage_rate');
            $table->string('fee_fixed_currency_code', 3)->nullable()->after('fee_fixed_amount');
            $table->decimal('fee_fixed_amount_converted', 14, 2)->nullable()->after('fee_fixed_currency_code');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('fee_policy_id');
            $table->dropColumn([
                'fee_policy_name',
                'fee_policy_type',
                'fee_percentage_rate',
                'fee_fixed_amount',
                'fee_fixed_currency_code',
                'fee_fixed_amount_converted',
            ]);
        });
    }
};
