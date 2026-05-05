<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('live_event_attendance_status', 32)->nullable()->after('manager_notes');
            $table->timestamp('live_event_checked_in_at')->nullable()->after('live_event_attendance_status');
            $table->timestamp('live_event_access_last_sent_at')->nullable()->after('live_event_checked_in_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'live_event_attendance_status',
                'live_event_checked_in_at',
                'live_event_access_last_sent_at',
            ]);
        });
    }
};
