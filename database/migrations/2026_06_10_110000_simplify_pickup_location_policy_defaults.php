<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE merchant_locations ALTER COLUMN pickup_grace_hours SET DEFAULT 0');

        DB::table('merchant_locations')->update([
            'pickup_grace_hours' => 0,
        ]);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE merchant_locations ALTER COLUMN pickup_grace_hours SET DEFAULT 12');
    }
};
