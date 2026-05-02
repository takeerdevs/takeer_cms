<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('currency_code', 3)->default('TZS')->after('type');
            $table->string('base_currency_code', 3)->default('USD')->after('currency_code');
            $table->decimal('fx_rate_to_base', 20, 10)->nullable()->after('base_currency_code')
                ->comment('Local currency units per 1 base currency unit at transaction time');
            $table->date('fx_rate_date')->nullable()->after('fx_rate_to_base');
            $table->decimal('gross_amount_base', 14, 2)->nullable()->after('gross_amount')
                ->comment('Gross converted into base currency');
            $table->decimal('fee_amount_base', 14, 2)->nullable()->after('fee_amount')
                ->comment('Takeer fee converted into base currency');
            $table->decimal('net_amount_base', 14, 2)->nullable()->after('net_amount')
                ->comment('Net converted into base currency');
            $table->decimal('tax_amount_base', 14, 2)->nullable()->after('tax_amount')
                ->comment('Tax converted into base currency');

            $table->index(['currency_code', 'created_at']);
            $table->index(['base_currency_code', 'created_at']);
        });

        $tzsRate = (float) (
            DB::table('exchange_rate_histories')
                ->where('base_currency_code', 'USD')
                ->where('currency_code', 'TZS')
                ->orderByDesc('effective_date')
                ->value('rate')
            ?: DB::table('currencies')
                ->where('code', 'TZS')
                ->value('exchange_rate')
            ?: 1
        );

        $tzsRate = max($tzsRate, 0.0000000001);

        DB::table('transactions')
            ->select(['id', 'gross_amount', 'fee_amount', 'net_amount', 'tax_amount'])
            ->orderBy('id')
            ->chunk(500, function ($transactions) use ($tzsRate): void {
                foreach ($transactions as $transaction) {
                    DB::table('transactions')
                        ->where('id', $transaction->id)
                        ->update([
                            'currency_code' => 'TZS',
                            'base_currency_code' => 'USD',
                            'fx_rate_to_base' => $tzsRate,
                            'fx_rate_date' => now()->toDateString(),
                            'gross_amount_base' => round(((float) $transaction->gross_amount) / $tzsRate, 2),
                            'fee_amount_base' => round(((float) $transaction->fee_amount) / $tzsRate, 2),
                            'net_amount_base' => round(((float) $transaction->net_amount) / $tzsRate, 2),
                            'tax_amount_base' => round(((float) $transaction->tax_amount) / $tzsRate, 2),
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['currency_code', 'created_at']);
            $table->dropIndex(['base_currency_code', 'created_at']);
            $table->dropColumn([
                'currency_code',
                'base_currency_code',
                'fx_rate_to_base',
                'fx_rate_date',
                'gross_amount_base',
                'fee_amount_base',
                'net_amount_base',
                'tax_amount_base',
            ]);
        });
    }
};
