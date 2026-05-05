<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_reports', function (Blueprint $table) {
            $table->string('appeal_status', 40)->nullable()->after('safety_state');
            $table->text('appeal_message')->nullable()->after('appeal_status');
            $table->timestamp('appealed_at')->nullable()->after('appeal_message');
            $table->timestamp('appeal_reviewed_at')->nullable()->after('appealed_at');

            $table->index('appeal_status');
        });
    }

    public function down(): void
    {
        Schema::table('content_reports', function (Blueprint $table) {
            $table->dropIndex(['appeal_status']);
            $table->dropColumn(['appeal_status', 'appeal_message', 'appealed_at', 'appeal_reviewed_at']);
        });
    }
};
