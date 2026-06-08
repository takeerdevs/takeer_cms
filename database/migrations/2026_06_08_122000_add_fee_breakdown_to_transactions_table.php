<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('transactions', 'provider_cost_amount')) {
                $table->decimal('provider_cost_amount', 14, 2)->default(0)->after('fee_amount');
            }
            if (! Schema::hasColumn('transactions', 'provider_cost_amount_base')) {
                $table->decimal('provider_cost_amount_base', 14, 2)->default(0)->after('provider_cost_amount');
            }
            if (! Schema::hasColumn('transactions', 'takeer_margin_amount')) {
                $table->decimal('takeer_margin_amount', 14, 2)->default(0)->after('provider_cost_amount_base');
            }
            if (! Schema::hasColumn('transactions', 'takeer_margin_amount_base')) {
                $table->decimal('takeer_margin_amount_base', 14, 2)->default(0)->after('takeer_margin_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $columns = [];
            foreach ([
                'provider_cost_amount',
                'provider_cost_amount_base',
                'takeer_margin_amount',
                'takeer_margin_amount_base',
            ] as $column) {
                if (Schema::hasColumn('transactions', $column)) {
                    $columns[] = $column;
                }
            }

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
