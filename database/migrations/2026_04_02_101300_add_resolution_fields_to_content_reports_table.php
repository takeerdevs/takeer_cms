<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_reports', function (Blueprint $table) {
            $table->foreignId('reviewed_by_id')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->string('action_taken')->nullable()->after('reviewed_by_id');
            $table->text('resolution_note')->nullable()->after('action_taken');
            $table->timestamp('resolved_at')->nullable()->after('resolution_note');
        });
    }

    public function down(): void
    {
        Schema::table('content_reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by_id');
            $table->dropColumn(['action_taken', 'resolution_note', 'resolved_at']);
        });
    }
};

