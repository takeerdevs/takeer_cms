<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('content_reports', function (Blueprint $table) {
            $table->string('reason_code', 80)->nullable()->after('reason');
            $table->string('report_context', 80)->nullable()->after('reason_code');
            $table->string('safety_state', 40)->default('reported')->after('status');
            $table->string('evidence_url', 2048)->nullable()->after('notes');
            $table->json('metadata')->nullable()->after('evidence_url');

            $table->index('reason_code');
            $table->index('report_context');
            $table->index('safety_state');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('bundles', function (Blueprint $table) {
            $table->softDeletes();
        });

        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('subscription_plans', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('bundles', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('content_reports', function (Blueprint $table) {
            $table->dropIndex(['reason_code']);
            $table->dropIndex(['report_context']);
            $table->dropIndex(['safety_state']);
            $table->dropColumn(['reason_code', 'report_context', 'safety_state', 'evidence_url', 'metadata']);
        });
    }
};
