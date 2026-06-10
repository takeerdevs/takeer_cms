<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check');
        DB::statement("ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check CHECK (status IN ('pending', 'processing', 'approved', 'completed', 'failed'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check');
        DB::statement("ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check CHECK (status IN ('pending', 'approved', 'completed', 'failed'))");
    }
};
