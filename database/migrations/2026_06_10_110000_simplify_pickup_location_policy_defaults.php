<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE merchant_locations ALTER COLUMN pickup_grace_hours SET DEFAULT 0');

        DB::table('merchant_locations')->update([
            'pickup_grace_hours' => 0,
            'pickup_holding_fee_enabled' => false,
            'pickup_late_fee_type' => 'fixed',
            'pickup_holding_fee_amount' => null,
            'pickup_late_fee_cap_amount' => null,
            'pickup_holding_fee_interval' => 'day',
        ]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE merchant_locations ALTER COLUMN pickup_grace_hours SET DEFAULT 12');
    }
};
