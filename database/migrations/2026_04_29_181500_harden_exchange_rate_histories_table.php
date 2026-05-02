<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        DB::table('exchange_rate_histories')
            ->select('currency_code', 'effective_date', DB::raw('MIN(id) as keep_id'))
            ->groupBy('currency_code', 'effective_date')
            ->orderBy('keep_id')
            ->chunk(500, function ($rates): void {
                foreach ($rates as $rate) {
                    DB::table('exchange_rate_histories')
                        ->where('currency_code', $rate->currency_code)
                        ->where('effective_date', $rate->effective_date)
                        ->where('id', '!=', $rate->keep_id)
                        ->delete();
                }
            });

        Schema::table('exchange_rate_histories', function (Blueprint $table) {
            $table->string('base_currency_code', 3)->default('USD')->after('currency_code');
            $table->string('source')->nullable()->after('is_manual');
            $table->unique(['base_currency_code', 'currency_code', 'effective_date'], 'exchange_rate_histories_base_currency_date_unique');
        });
    }

    public function down(): void
    {
        Schema::table('exchange_rate_histories', function (Blueprint $table) {
            $table->dropUnique('exchange_rate_histories_base_currency_date_unique');
            $table->dropColumn(['base_currency_code', 'source']);
        });
    }
};
