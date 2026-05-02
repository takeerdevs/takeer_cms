<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_service_credentials', function (Blueprint $table) {
            $table->json('review_checklist')->nullable()->after('rejection_reason');
            $table->text('review_notes')->nullable()->after('review_checklist');
            $table->timestamp('last_expiry_reminder_at')->nullable()->after('reviewed_at');
            $table->timestamp('expired_at')->nullable()->after('last_expiry_reminder_at');

            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::table('merchant_service_credentials', function (Blueprint $table) {
            $table->dropIndex(['status', 'expires_at']);
            $table->dropColumn([
                'review_checklist',
                'review_notes',
                'last_expiry_reminder_at',
                'expired_at',
            ]);
        });
    }
};
