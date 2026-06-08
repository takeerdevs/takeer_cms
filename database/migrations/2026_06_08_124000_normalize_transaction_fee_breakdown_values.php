<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'fee_amount',
            'fee_amount_base',
            'provider_cost_amount',
            'provider_cost_amount_base',
            'takeer_margin_amount',
            'takeer_margin_amount_base',
        ] as $column) {
            if (! Schema::hasColumn('transactions', $column)) {
                return;
            }
        }

        DB::table('transactions')
            ->whereNull('provider_cost_amount')
            ->update(['provider_cost_amount' => 0]);

        DB::table('transactions')
            ->whereNull('provider_cost_amount_base')
            ->update(['provider_cost_amount_base' => 0]);

        DB::table('transactions')
            ->whereNull('takeer_margin_amount')
            ->update(['takeer_margin_amount' => DB::raw('COALESCE(fee_amount, 0)')]);

        DB::table('transactions')
            ->whereNull('takeer_margin_amount_base')
            ->update(['takeer_margin_amount_base' => DB::raw('COALESCE(fee_amount_base, 0)')]);
    }

    public function down(): void
    {
        // Intentionally no-op: normalized accounting values should remain explicit.
    }
};
