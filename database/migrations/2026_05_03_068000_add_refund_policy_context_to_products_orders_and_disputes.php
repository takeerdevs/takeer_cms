<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('refund_policy', 40)->default('standard')->after('allow_download');
            $table->unsignedSmallInteger('refund_window_days')->nullable()->after('refund_policy');
            $table->text('refund_policy_note')->nullable()->after('refund_window_days');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedInteger('download_count')->default(0)->after('custom_delivery_accepted_at');
            $table->timestamp('first_downloaded_at')->nullable()->after('download_count');
            $table->timestamp('refund_locked_at')->nullable()->after('first_downloaded_at');
            $table->string('refund_lock_reason', 120)->nullable()->after('refund_locked_at');
        });

        Schema::table('disputes', function (Blueprint $table) {
            $table->string('refund_eligibility_status', 40)->nullable()->after('dispute_reason');
            $table->text('refund_eligibility_reason')->nullable()->after('refund_eligibility_status');
            $table->json('refund_policy_snapshot')->nullable()->after('refund_eligibility_reason');
        });
    }

    public function down(): void
    {
        Schema::table('disputes', function (Blueprint $table) {
            $table->dropColumn(['refund_eligibility_status', 'refund_eligibility_reason', 'refund_policy_snapshot']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['download_count', 'first_downloaded_at', 'refund_locked_at', 'refund_lock_reason']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['refund_policy', 'refund_window_days', 'refund_policy_note']);
        });
    }
};
