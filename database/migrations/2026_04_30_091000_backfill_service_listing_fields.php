<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('products')
            ->where('type', 'service')
            ->where(function ($query) {
                $query->where('service_is_showcase', true)
                    ->orWhere('service_pricing_model', 'showcase_only');
            })
            ->update([
                'service_mode' => 'showcase_only',
                'service_price_display' => 'hidden',
            ]);

        DB::table('products')
            ->where('type', 'service')
            ->where('service_pricing_model', 'contract_quote')
            ->update([
                'service_mode' => 'request_quote',
                'service_price_display' => 'quote_only',
            ]);

        DB::table('products')
            ->where('type', 'service')
            ->where('service_pricing_model', 'hourly_rate')
            ->update([
                'service_price_display' => 'hourly',
            ]);

        DB::table('products')
            ->where('type', 'service')
            ->where('service_mode', 'pay_now')
            ->where(function ($query) {
                $query->where('url', 'like', 'http://%')
                    ->orWhere('url', 'like', 'https://%');
            })
            ->update([
                'service_mode' => 'external_booking',
                'service_booking_provider' => 'external',
            ]);
    }

    public function down(): void
    {
        DB::table('products')
            ->where('type', 'service')
            ->update([
                'service_mode' => 'pay_now',
                'service_price_display' => 'fixed',
                'service_booking_provider' => 'manual',
            ]);
    }
};
