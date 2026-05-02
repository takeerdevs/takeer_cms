<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->timestamp('scheduled_ends_at')->nullable()->after('scheduled_at');
            $table->string('timezone')->nullable()->after('scheduled_ends_at');
            $table->string('calendar_provider')->nullable()->after('booking_provider');
            $table->string('calendar_sync_status')->default('pending')->after('calendar_provider');
            $table->string('calendar_event_id')->nullable()->after('calendar_sync_status');
            $table->text('calendar_sync_error')->nullable()->after('calendar_event_id');
            $table->timestamp('calendar_synced_at')->nullable()->after('calendar_sync_error');
        });
    }

    public function down(): void
    {
        Schema::table('service_requests', function (Blueprint $table) {
            $table->dropColumn([
                'scheduled_ends_at',
                'timezone',
                'calendar_provider',
                'calendar_sync_status',
                'calendar_event_id',
                'calendar_sync_error',
                'calendar_synced_at',
            ]);
        });
    }
};
