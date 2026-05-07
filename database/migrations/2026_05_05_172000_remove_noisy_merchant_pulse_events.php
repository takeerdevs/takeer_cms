<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('pulse_notifications')
            ->where('event_type', 'merchant_digital_access_used')
            ->delete();
    }

    public function down(): void
    {
        //
    }
};
