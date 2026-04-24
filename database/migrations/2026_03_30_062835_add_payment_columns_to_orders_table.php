<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add payment gateway tracking columns to orders table.
     * Non-destructive — all columns are nullable.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Which gateway processed this payment (e.g. 'azampay', 'mpesa_ke', 'flutterwave')
            $table->string('payment_gateway')->nullable()->after('idempotency_key')
                ->comment('Gateway driver name: azampay | mpesa_ke | flutterwave | stripe');

            // ISO 3166-1 alpha-2 country where payment was processed
            $table->char('country_code', 2)->nullable()->after('payment_gateway')
                ->comment('ISO country code: TZ | KE | UG | NG');

            // The gateway's own transaction/reference ID (for reconciliation & support)
            $table->string('gateway_ref')->nullable()->after('country_code')
                ->comment('Gateway transaction ID for reconciliation');

            $table->index('payment_gateway');
            $table->index('country_code');
            $table->index('gateway_ref');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['payment_gateway']);
            $table->dropIndex(['country_code']);
            $table->dropIndex(['gateway_ref']);
            $table->dropColumn(['payment_gateway', 'country_code', 'gateway_ref']);
        });
    }
};
