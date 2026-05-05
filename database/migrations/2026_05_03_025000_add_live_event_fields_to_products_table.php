<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->timestamp('live_event_starts_at')->nullable()->after('allow_download');
            $table->unsignedInteger('live_event_duration_minutes')->nullable()->after('live_event_starts_at');
            $table->string('live_event_timezone', 80)->nullable()->after('live_event_duration_minutes');
            $table->string('live_event_access_url', 2048)->nullable()->after('live_event_timezone');
            $table->string('live_event_venue', 255)->nullable()->after('live_event_access_url');
            $table->unsignedInteger('live_event_capacity')->nullable()->after('live_event_venue');
            $table->string('live_event_replay_url', 2048)->nullable()->after('live_event_capacity');
            $table->text('live_event_instructions')->nullable()->after('live_event_replay_url');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'live_event_starts_at',
                'live_event_duration_minutes',
                'live_event_timezone',
                'live_event_access_url',
                'live_event_venue',
                'live_event_capacity',
                'live_event_replay_url',
                'live_event_instructions',
            ]);
        });
    }
};
