<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->string('channel', 40)->default('sms')->after('user_id');
            $table->string('recipient')->nullable()->after('channel');
            $table->string('email')->nullable()->after('phone');
            $table->string('whatsapp')->nullable()->after('email');
            $table->string('subject')->nullable()->after('message');
            $table->json('metadata')->nullable()->after('gateway');

            $table->index(['channel', 'status']);
        });

        if (DB::connection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE notification_logs ALTER COLUMN phone DROP NOT NULL');
        }
    }

    public function down(): void
    {
        Schema::table('notification_logs', function (Blueprint $table) {
            $table->dropIndex(['channel', 'status']);
            $table->dropColumn([
                'channel',
                'recipient',
                'email',
                'whatsapp',
                'subject',
                'metadata',
            ]);
        });

        DB::statement("UPDATE notification_logs SET phone = recipient WHERE phone IS NULL AND recipient IS NOT NULL");
        DB::statement("UPDATE notification_logs SET phone = '' WHERE phone IS NULL");
        if (DB::connection()->getDriverName() !== 'sqlite') {
            DB::statement('ALTER TABLE notification_logs ALTER COLUMN phone SET NOT NULL');
        }
    }
};
