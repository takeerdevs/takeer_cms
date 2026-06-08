<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->string('merchant_currency_code', 3)->nullable()->after('amount');
            $table->string('payout_currency_code', 3)->nullable()->after('merchant_currency_code');
            $table->string('fx_base_currency_code', 3)->nullable()->after('payout_currency_code');
            $table->decimal('fx_rate_merchant_to_base', 20, 10)->nullable()->after('fx_base_currency_code');
            $table->decimal('fx_rate_payout_to_base', 20, 10)->nullable()->after('fx_rate_merchant_to_base');
            $table->decimal('fx_rate_merchant_to_payout', 20, 10)->nullable()->after('fx_rate_payout_to_base');
            $table->date('fx_rate_date')->nullable()->after('fx_rate_merchant_to_payout');
            $table->decimal('merchant_amount', 14, 2)->nullable()->after('fx_rate_date');
            $table->decimal('payout_amount', 14, 2)->nullable()->after('merchant_amount');
            $table->json('payout_snapshot')->nullable()->after('payout_amount');

            $table->index(['merchant_currency_code', 'created_at']);
            $table->index(['payout_currency_code', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->dropIndex(['merchant_currency_code', 'created_at']);
            $table->dropIndex(['payout_currency_code', 'created_at']);
            $table->dropColumn([
                'merchant_currency_code',
                'payout_currency_code',
                'fx_base_currency_code',
                'fx_rate_merchant_to_base',
                'fx_rate_payout_to_base',
                'fx_rate_merchant_to_payout',
                'fx_rate_date',
                'merchant_amount',
                'payout_amount',
                'payout_snapshot',
            ]);
        });
    }
};
