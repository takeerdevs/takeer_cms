<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('fx_market_rate_merchant_to_customer', 20, 10)->nullable()->after('fx_rate_merchant_to_customer');
            $table->decimal('fx_effective_rate_merchant_to_customer', 20, 10)->nullable()->after('fx_market_rate_merchant_to_customer');
            $table->unsignedInteger('fx_spread_bps')->default(0)->after('fx_effective_rate_merchant_to_customer');
            $table->decimal('fx_spread_amount', 14, 2)->nullable()->after('fx_spread_bps');
            $table->string('fx_spread_currency_code', 3)->nullable()->after('fx_spread_amount');
            $table->json('money_quote_snapshot')->nullable()->after('payment_channel_snapshot');

            $table->index(['fx_spread_currency_code', 'created_at']);
        });

        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->decimal('fx_market_rate_merchant_to_payout', 20, 10)->nullable()->after('fx_rate_merchant_to_payout');
            $table->decimal('fx_effective_rate_merchant_to_payout', 20, 10)->nullable()->after('fx_market_rate_merchant_to_payout');
            $table->unsignedInteger('fx_spread_bps')->default(0)->after('fx_effective_rate_merchant_to_payout');
            $table->decimal('fx_spread_amount', 14, 2)->nullable()->after('fx_spread_bps');
            $table->string('fx_spread_currency_code', 3)->nullable()->after('fx_spread_amount');
            $table->json('money_quote_snapshot')->nullable()->after('payout_snapshot');

            $table->index(['fx_spread_currency_code', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['fx_spread_currency_code', 'created_at']);
            $table->dropColumn([
                'fx_market_rate_merchant_to_customer',
                'fx_effective_rate_merchant_to_customer',
                'fx_spread_bps',
                'fx_spread_amount',
                'fx_spread_currency_code',
                'money_quote_snapshot',
            ]);
        });

        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->dropIndex(['fx_spread_currency_code', 'created_at']);
            $table->dropColumn([
                'fx_market_rate_merchant_to_payout',
                'fx_effective_rate_merchant_to_payout',
                'fx_spread_bps',
                'fx_spread_amount',
                'fx_spread_currency_code',
                'money_quote_snapshot',
            ]);
        });
    }
};
