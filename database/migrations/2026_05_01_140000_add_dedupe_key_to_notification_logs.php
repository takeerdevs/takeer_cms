<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->string('dedupe_key')->nullable()->after('gateway');
            $table->unique(['channel', 'dedupe_key'], 'notification_logs_channel_dedupe_unique');
        });
    }

    public function down(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->dropUnique('notification_logs_channel_dedupe_unique');
            $table->dropColumn('dedupe_key');
        });
    }
};
